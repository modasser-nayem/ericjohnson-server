import { BaseEngine } from "./base.engine";
import { validateHost, validatePlayer } from "../middleware/validation";
import { acquireLock, releaseLock } from "../utils/lock";
import {
   saveGameEvent,
   upsertGameSession,
} from "../services/game-history.service";
import { GameConfigRegistry } from "../core/game-config";
import { GameSession, GameConfig } from "../types/game";

export class InternetBachelorEngine extends BaseEngine {
   async handleEvent(
      type: string,
      payload: any,
      session: GameSession,
      config: GameConfig,
      socket: any,
      userId: string,
   ) {
      const lockKey = `game:${session.id}`;
      const hasLock = await acquireLock(lockKey);
      if (!hasLock) throw new Error("Another operation in progress");

      try {
         switch (type) {
            case "PLAYER_READY":
               await this.setReady(session, userId);
               break;

            case "START_GAME":
               validateHost(session, userId);
               const allReady = session.players.every((p: any) => p.isReady);
               if (!allReady) throw new Error("Not all players are ready");
               await this.startGame(session, config);
               break;

            case "SEND_QUESTION":
               validateHost(session, userId);
               await this.sendQuestion(session, payload.question);
               break;

            case "TYPING":
               // Broadcast typing status from authenticated user to the room
               await this.emitToRoom(session.id, "USER_TYPING", {
                  userId,
                  isTyping: payload.isTyping,
               });
               break;

            case "SUBMIT_DATA":
               validatePlayer(session, userId);
               const currentRoundType =
                  config.rounds[session.currentRoundIndex]?.type;

               // Ensure the authenticated userId is used in the submission logic
               const submissionPayload = { ...payload, userId };

               if (currentRoundType === "QUESTION") {
                  await this.submitAnswer(session, submissionPayload);
               } else {
                  await this.submit(session, submissionPayload, "DATA_UPDATE");
               }
               break;

            case "ELIMINATE":
               validateHost(session, userId);
               await this.eliminate(session, payload);
               break;

            case "NEXT_ROUND":
               validateHost(session, userId);
               await this.nextRound(session, config);
               break;


            case "CALL_PLAYER":
               validateHost(session, userId);
               if (payload.userId) {
                  await this.emitToPlayer(
                     session,
                     payload.userId,
                     "INCOMING_CALL",
                     { hostId: userId },
                  );
               }
               break;

            case "ACCEPT_CALL":
               validatePlayer(session, userId);
               await this.emitToHost(session, "CALL_ACCEPTED", { userId });
               break;

            case "REJECT_CALL":
               validatePlayer(session, userId);
               await this.emitToHost(session, "CALL_REJECTED", { userId });
               break;

            case "END_CALL":
               validateHost(session, userId);
               if (payload.userId) {
                  await this.emitToPlayer(
                     session,
                     payload.userId,
                     "CALL_ENDED",
                     { hostId: userId },
                  );
               }
               break;

            case "EXIT_GAME":
               await this.leaveGame(session, userId, socket);
               break;

            default:
               throw new Error(`Unsupported event type: ${type}`);
         }

         await saveGameEvent({
            gameId: session.id,
            type,
            roundIndex: session.currentRoundIndex,
            payload,
         });

         await upsertGameSession(session);
      } finally {
         await releaseLock(lockKey);
      }
   }

   async setReady(session: GameSession, userId: string) {
      const player = session.players.find((p) => p.id === userId);
      if (player) {
         player.isReady = true;
         await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
      }
   }

   async sendQuestion(session: GameSession, question: string) {
      session.roundState.currentQuestion = question;
      session.roundState.submissions = []; // Initialize as array
      session.roundState.submittedPlayers = [];

      // Reset submission status for all players
      session.players.forEach((p) => {
         p.hasSubmitted = false;
      });

      await this.emitToRoom(session.id, "NEW_QUESTION", { question });
      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
   }

   async submitAnswer(session: GameSession, payload: any) {
      const userId = payload.userId;
      const answer = payload.answer || payload.data?.answer;

      if (!answer) {
         throw new Error("Answer is required");
      }

      await this.submit(
         session,
         { userId, data: { userId, answer } },
         "ANSWER_SUBMITTED",
      );
   }

   async submit(session: GameSession, payload: any, event: string) {
      const { userId, data = {} } = payload;

      if (session.roundState.submittedPlayers.includes(userId)) {
         throw new Error("Already submitted for this question");
      }

      // Inject the userId into the data object so the host knows who submitted it
      data.userId = userId;

      session.roundState.submittedPlayers.push(userId);
      session.roundState.submissions.push(data); // Push to array

      // Update player status
      const player = session.players.find((p) => p.id === userId);
      if (player) {
         player.hasSubmitted = true;
      }

      // Notify host of the specific submission
      await this.emitToHost(session, event, {
         userId,
         data,
         allSubmissions: session.roundState.submissions,
      });

      // Notify everyone of the progress update
      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
   }

   async eliminate(session: GameSession, payload: any) {
      const pointsToAward = payload.points || 0;
      payload.playerIds.forEach((id: string) => {
         const p = session.players.find((x) => x.id === id);
         if (p) {
            p.isEliminated = true;
            p.points = (p.points || 0) + pointsToAward;
         }
      });

      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);

      const alive = session.players.filter((p) => !p.isEliminated);

      // Check if we can advance
      const config = GameConfigRegistry[session.gameType];
      const currentRound = config.rounds[session.currentRoundIndex];

      if (alive.length <= (currentRound?.nextAtCount || 1)) {
         if (alive.length === 1) {
            await this.endGame(session);
         } else {
            const nextRoundIndex = session.currentRoundIndex + 1;
            const nextRound = config.rounds[nextRoundIndex];
            await this.emitToHost(session, "CAN_NEXT", {
               nextRoundIndex,
               label: nextRound ? `Start ${nextRound.type} Round` : "Finish Game",
            });
         }
      }
   }

   async leaveGame(session: GameSession, userId: string, socket: any) {
      // Remove player from session
      session.players = session.players.filter((p) => p.id !== userId);

      // Notify room
      await this.emitToRoom(session.id, "NETWORK_STATUS", {
         userId,
         isConnected: false,
         isHost: session.hostId === userId,
         message: `User ${userId} left the game`,
      });

      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);

      // If host left, end the game or handle migration (for now just end if it's bachelor)
      if (session.hostId === userId) {
         await this.endGame(session);
      }

      // Cleanup socket
      socket.leave(session.id);
   }
}

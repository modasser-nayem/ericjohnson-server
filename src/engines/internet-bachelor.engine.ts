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
               await this.setReady(session, payload.userId);
               break;

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
               // Broadcast typing status from any user to the room
               await this.emitToRoom(session.id, "USER_TYPING", {
                  userId: payload.userId,
                  isTyping: payload.isTyping,
               });
               break;

            case "SUBMIT_DATA":
               validatePlayer(session, payload.userId);
               const currentRoundType =
                  config.rounds[session.currentRoundIndex]?.type;
               if (currentRoundType === "QUESTION") {
                  await this.submitAnswer(session, payload);
               } else {
                  await this.submit(session, payload, "DATA_UPDATE");
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

            case "HOST_ACTION":
               validateHost(session, userId);
               // General purpose host actions (like starting video, calling player, etc.)
               // The payload.action defines what happened
               await this.emitToRoom(session.id, "ROUND_ACTION", payload);
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

      await this.emitToRoom(session.id, "NEW_QUESTION", { question });
   }

   async submitAnswer(session: GameSession, payload: any) {
      const { userId, answer } = payload;

      // Prevent duplicate answers in the array
      const previousAnswers = session.roundState.submissions.map((s: any) => s.answer);
      if (previousAnswers.includes(answer)) {
         throw new Error("Answer already submitted by someone else");
      }

      await this.submit(
         session,
         { userId, data: { userId, answer } },
         "ANSWER_SUBMITTED",
      );
   }

   async submit(session: GameSession, payload: any, event: string) {
      const { userId, data } = payload;

      if (session.roundState.submittedPlayers.includes(userId)) {
         throw new Error("Already submitted for this question");
      }

      session.roundState.submittedPlayers.push(userId);
      session.roundState.submissions.push(data); // Push to array

      await this.emitToHost(session, event, {
         userId,
         data,
         allSubmissions: session.roundState.submissions,
      });
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

      if (alive.length <= (currentRound.nextAtCount || 1)) {
         if (alive.length === 1) {
            await this.endGame(session);
         } else {
            const nextRoundIndex = session.currentRoundIndex + 1;
            await this.emitToHost(session, "CAN_NEXT", {
               nextRoundIndex,
            });
         }
      }
   }
}

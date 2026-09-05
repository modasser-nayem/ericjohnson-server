import { BaseEngine } from "./base.engine";
import { validateHost, validatePlayer } from "../middleware/validation";
import { acquireLock, releaseLock } from "../utils/lock";
import {
   saveGameEvent,
   upsertGameSession,
} from "../services/game-history.service";
import { GameConfigRegistry } from "../core/game-config";
import { GameSession, GameConfig } from "../types/game";
import { removeUserFromGameMapping } from "../services/game.service";

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

            case "START_GAME": {
               validateHost(session, userId);
               const minReq = config.minPlayers || 4;
               if (!session.players || session.players.length < minReq) {
                  throw new Error(
                     `Minimum ${minReq} players required to start the game (currently ${session.players?.length || 0})`,
                  );
               }
               const allReady = session.players.every((p: any) => p.isReady);
               if (!allReady) throw new Error("Not all players are ready");

               // Allow the host to override per-round timeouts from the frontend.
               // roundTimeouts is an optional array of numbers (ms) aligned to rounds[].
               // A value of 0 means no timeout for that round (e.g. VIDEO).
               let effectiveConfig = config;
               if (Array.isArray(payload?.roundTimeouts) && payload.roundTimeouts.length > 0) {
                  effectiveConfig = {
                     ...config,
                     rounds: config.rounds.map((round: any, i: number) => ({
                        ...round,
                        timeoutMs: typeof payload.roundTimeouts[i] === "number"
                           ? payload.roundTimeouts[i]
                           : round.timeoutMs,
                     })),
                  };
               }

               await this.startGame(session, effectiveConfig);
               break;
            }

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

            case "DECLARE_NEITHER": {
               validateHost(session, userId);

               const currentRound = config.rounds[session.currentRoundIndex];

               // Round must explicitly opt-in to the "Neither" option
               if (!currentRound?.allowNeither) {
                  throw new Error(
                     "DECLARE_NEITHER is not allowed in this round",
                  );
               }

               // There must still be more players than the round's target —
               // i.e. the host hasn't already been forced to pick a winner.
               // The threshold is derived from nextAtCount (e.g. > 1 means 2+ remain).
               const remaining = session.players.filter((p) => !p.isEliminated);
               if (remaining.length <= currentRound.nextAtCount) {
                  throw new Error(
                     "DECLARE_NEITHER requires more than one finalist remaining",
                  );
               }

               await this.endGame(session, /* noWinner */ true);
               break;
            }

            case "EXIT_GAME":
               await this.leaveGame(session, userId, socket);
               break;

            case "REMOVE_PLAYER":
               validateHost(session, userId);
               if (session.status !== "LOBBY") {
                  throw new Error("Cannot remove players after the game has started");
               }
               if (!payload || !payload.userId) {
                  throw new Error("Player ID to remove is required");
               }
               await this.removePlayer(session, payload.userId, socket);
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

      // Check if all remaining active players submitted
      await this.checkRoundCompletion(session);
   }

   async checkRoundCompletion(session: GameSession) {
      if (session.status !== "IN_PROGRESS") return;

      const alive = session.players.filter((p) => !p.isEliminated);
      const aliveConnected = alive.filter((p) => p.isConnected !== false);

      // If 1 or 0 active connected players remain, end the game
      if (aliveConnected.length <= 1 && alive.length <= 1) {
         await this.endGame(session);
         return;
      }

      // Check if all active non-eliminated connected players have submitted
      const submittedSet = new Set(session.roundState?.submittedPlayers || []);
      const activeSubmitted = aliveConnected.filter((p) => submittedSet.has(p.id));

      if (aliveConnected.length > 0 && activeSubmitted.length >= aliveConnected.length) {
         await this.emitToHost(session, "ALL_SUBMITTED", {
            roundIndex: session.currentRoundIndex,
            totalSubmitted: session.roundState.submissions.length,
         });
      }
   }

   async eliminate(session: GameSession, payload: any) {
      const loserPoints = payload.points || 0;
      const winnerPoints = payload.winnerPoints || 0;

      // Apply loser points and mark eliminated
      payload.playerIds.forEach((id: string) => {
         const p = session.players.find((x) => x.id === id);
         if (p) {
            p.isEliminated = true;
            p.points = (p.points || 0) + loserPoints;
         }
      });

      const alive = session.players.filter((p) => !p.isEliminated);

      // Award winner points to surviving players (if provided)
      if (winnerPoints > 0) {
         alive.forEach((p) => {
            p.points = (p.points || 0) + winnerPoints;
         });
      }

      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
      payload.playerIds.forEach((id: string) => {
         this.emitToRoom(session.id, "PLAYER_ELIMINATED", {
            userId: id,
            playerIds: payload.playerIds,
            points: loserPoints,
         });
      });

      // Check if we can advance
      const config = GameConfigRegistry[session.gameType];
      const currentRound = config.rounds[session.currentRoundIndex];
      const nextRoundIndex = session.currentRoundIndex + 1;
      const nextRound = config.rounds[nextRoundIndex];
      const isLastRound = !nextRound;

      if (alive.length <= (currentRound?.nextAtCount || 1)) {
         if (isLastRound || alive.length <= 1) {
            // Final round or only one player left — end the game
            await this.endGame(session);
         } else {
            // More rounds remain — let host advance
            await this.emitToHost(session, "CAN_NEXT", {
               nextRoundIndex,
               label: `Start ${nextRound.type} Round`,
            });
         }
      }
   }

   async leaveGame(session: GameSession, userId: string, socket: any) {
      const isHost = session.hostId === userId;

      if (isHost) {
         // Host left the game — end session
         session.status = "ENDED";
         await removeUserFromGameMapping(userId);
         await this.endGame(session, true /* noWinner */);
         if (socket) socket.leave(session.id);
         return;
      }

      if (session.status === "LOBBY") {
         // In lobby: remove player completely
         session.players = session.players.filter((p) => p.id !== userId);
         await removeUserFromGameMapping(userId);
         if (socket) socket.leave(session.id);

         await this.emitToRoom(session.id, "NETWORK_STATUS", {
            userId,
            isConnected: false,
            isHost: false,
            message: `User ${userId} left the lobby`,
         });
         await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
      } else {
         // In progress: mark as eliminated & disconnected
         const player = session.players.find((p) => p.id === userId);
         if (player) {
            player.isEliminated = true;
            player.isConnected = false;
         }
         await removeUserFromGameMapping(userId);
         if (socket) socket.leave(session.id);

         await this.emitToRoom(session.id, "NETWORK_STATUS", {
            userId,
            isConnected: false,
            isHost: false,
            message: `User ${userId} left the game`,
         });
         await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);

         // Re-evaluate round state & remaining players
         await this.checkRoundCompletion(session);
      }
   }

   async removePlayer(session: GameSession, targetUserId: string, socket: any) {
      const player = session.players.find((p) => p.id === targetUserId);
      if (!player) {
         throw new Error("Player not found in this game");
      }

      // Emit KICKED event to the target player so their UI knows they were kicked
      // Do this before removing the player so emitToPlayer can lookup the player's socketId
      await this.emitToPlayer(session, targetUserId, "KICKED", {
         gameId: session.id,
         message: "You have been removed from the room by the host.",
      });

      // Remove player from session
      session.players = session.players.filter((p) => p.id !== targetUserId);

      // Cleanup user game mapping in Redis
      await removeUserFromGameMapping(targetUserId);

      // Force the socket to leave the room
      const io = socket.server;
      if (io && player.socketId) {
         io.in(player.socketId).socketsLeave(session.id);
      }

      // Notify the remaining players in the room about the player leaving
      await this.emitToRoom(session.id, "NETWORK_STATUS", {
         userId: targetUserId,
         isConnected: false,
         isHost: false,
         message: `User ${targetUserId} was removed by the host`,
      });

      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);
   }
}

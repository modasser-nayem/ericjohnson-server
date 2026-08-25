import { publishEvent } from "../config/pubsub";
import { addGameJob } from "../queue/game.queue";
import { getSession } from "../services/game.service";
import { GameSession, GameConfig } from "../types/game";

export class BaseEngine {
   async emitToRoom(roomId: string, type: string, payload: any) {
      await publishEvent("GAME_EVENTS", {
         roomId,
         type,
         payload, // We keep this simple here, wrap it in event-stream
      });
   }

   async emitToHost(session: any, type: string, payload: any) {
      await publishEvent("GAME_EVENTS", {
         roomId: session.hostSocketId,
         type,
         payload,
      });
   }

   async emitToPlayer(session: GameSession, targetUserId: string, type: string, payload: any) {
      const player = session.players.find(p => p.id === targetUserId);
      if (player && player.socketId) {
         await publishEvent("GAME_EVENTS", {
            roomId: player.socketId,
            type,
            payload,
         });
      }
   }

   async startGame(session: GameSession, config: GameConfig) {
      session.status = "IN_PROGRESS";
      session.currentRoundIndex = 0;
      await this.startRound(session, config);
   }

   async startRound(session: GameSession, config: GameConfig) {
      const round = config.rounds[session.currentRoundIndex];
      const capturedRoundIndex = session.currentRoundIndex;

      session.roundState = {
         submissions: [],
         submittedPlayers: [],
         startTime: Date.now(),
      };

      // Reset submission status for all players
      session.players.forEach((p) => {
         p.hasSubmitted = false;
      });

      // ⏱ Per-round timeout — skip if timeoutMs is 0 (e.g. VIDEO round is host-driven)
      const timeoutMs: number = round.timeoutMs ?? 60000;
      if (timeoutMs > 0) {
         setTimeout(() => {
            void this.handleTimeout(session.id, capturedRoundIndex);
         }, timeoutMs);
      }

      await this.emitToRoom(session.id, "ROUND_STARTED", round);
   }

   async handleTimeout(sessionId: string, capturedRoundIndex: number) {
      // Re-fetch live session from Redis — never trust the stale closure reference
      const liveSession = await getSession(sessionId);
      if (!liveSession) return;
      if (liveSession.status !== "IN_PROGRESS") return;
      // Guard: ensure we're still on the same round — old timers must not fire after NEXT_ROUND
      if (liveSession.currentRoundIndex !== capturedRoundIndex) return;

      await this.emitToRoom(sessionId, "ROUND_TIMEOUT", {});
   }

   async nextRound(session: GameSession, config: GameConfig) {
      session.currentRoundIndex++;

      if (session.currentRoundIndex >= config.rounds.length) {
         await this.endGame(session);
         return;
      }

      await this.startRound(session, config);
   }

   async endGame(session: GameSession, noWinner = false) {
      session.status = "ENDED";

      if (noWinner) {
         // Eliminate every remaining player — nobody wins
         session.players.forEach((p) => {
            p.isEliminated = true;
         });
         session.winnerId = null;

         await this.emitToRoom(session.id, "GAME_ENDED", {
            winner: null,
            noWinner: true,
         });
      } else {
         const winner = session.players.find((p) => !p.isEliminated);
         session.winnerId = winner?.id ?? null;

         await this.emitToRoom(session.id, "GAME_ENDED", { winner: winner ?? null });
      }

      await addGameJob("FINALIZE_GAME", {
         gameId: session.id,
         winnerId: session.winnerId,
      });
   }
}

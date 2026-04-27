import { publishEvent } from "../config/pubsub";
import { addGameJob } from "../queue/game.queue";
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

   async startGame(session: GameSession, config: GameConfig) {
      session.status = "IN_PROGRESS";
      session.currentRoundIndex = 0;
      await this.startRound(session, config);
   }

   async startRound(session: GameSession, config: GameConfig) {
      const round = config.rounds[session.currentRoundIndex];

      session.roundState = {
         submissions: [],
         submittedPlayers: [],
         startTime: Date.now(),
      };

      // ⏱ Timeout fallback (e.g. 60s)
      setTimeout(() => {
         void this.handleTimeout(session, config);
      }, 60000);

      await this.emitToRoom(session.id, "ROUND_STARTED", round);
   }

   async handleTimeout(session: GameSession, _config: GameConfig) {
      if (session.status !== "IN_PROGRESS") return;

      await this.emitToRoom(session.id, "ROUND_TIMEOUT", {});
   }

   async nextRound(session: GameSession, config: GameConfig) {
      session.currentRoundIndex++;

      if (session.currentRoundIndex >= config.rounds.length) {
         await this.endGame(session);
         return;
      }

      await this.startRound(session, config);
   }

   async endGame(session: GameSession) {
      session.status = "ENDED";

      const winner = session.players.find((p) => !p.isEliminated);
      session.winnerId = winner?.id ?? null;

      await this.emitToRoom(session.id, "GAME_ENDED", { winner });
      await addGameJob("FINALIZE_GAME", {
         gameId: session.id,
         winnerId: session.winnerId,
      });
   }
}

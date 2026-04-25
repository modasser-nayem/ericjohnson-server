import { publishEvent } from "../config/pubsub";
import { io } from "../config/socket";

export class BaseEngine {
   emitToRoom(roomId: string, type: string, payload: any) {
      publishEvent("GAME_EVENTS", {
         roomId,
         type,
         payload,
      });
   }

   emitToHost(session: any, type: string, payload: any) {
      publishEvent("GAME_EVENTS", {
         roomId: session.hostSocketId,
         type,
         payload,
      });
   }

   startGame(session: any, config: any) {
      session.status = "IN_PROGRESS";
      session.currentRoundIndex = 0;
      this.startRound(session, config);
   }

   startRound(session: any, config: any) {
      const round = config.rounds[session.currentRoundIndex];

      session.roundState = {
         submissions: {},
         submittedPlayers: [],
         startTime: Date.now(),
      };

      // ⏱ Timeout fallback (e.g. 60s)
      setTimeout(() => {
         this.handleTimeout(session, config);
      }, 60000);

      this.emitToRoom(session.id, "ROUND_STARTED", round);
   }

   handleTimeout(session: any, config: any) {
      if (session.status !== "IN_PROGRESS") return;

      this.emitToRoom(session.id, "ROUND_TIMEOUT", {});
   }

   nextRound(session: any, config: any) {
      session.currentRoundIndex++;

      if (session.currentRoundIndex >= config.rounds.length) {
         return this.endGame(session);
      }

      this.startRound(session, config);
   }

   endGame(session: any) {
      session.status = "ENDED";

      const winner = session.players.find((p: any) => !p.isEliminated);

      this.emitToRoom(session.id, "GAME_ENDED", { winner });
   }
}

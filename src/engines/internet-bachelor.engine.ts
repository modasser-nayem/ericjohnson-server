import { BaseEngine } from "./base.engine";
import { validateHost, validatePlayer } from "../middleware/validation";
import { acquireLock, releaseLock } from "../utils/lock";
import {
   saveGameEvent,
   upsertGameSession,
} from "../services/game-history.service";

export class InternetBachelorEngine extends BaseEngine {
   async handleEvent(
      type: string,
      payload: any,
      session: any,
      config: any,
      socket: any,
   ) {
      const lockKey = `game:${session.id}`;
      const hasLock = await acquireLock(lockKey);
      if (!hasLock) throw new Error("Another operation in progress");

      try {
         switch (type) {
            case "START_GAME":
               validateHost(session, socket.id);
               await this.startGame(session, config);
               break;

            case "SUBMIT_ANSWER":
               validatePlayer(session, payload.userId);
               await this.submit(session, payload, "ANSWER_UPDATE");
               break;

            case "SUBMIT_IMAGE":
               validatePlayer(session, payload.userId);
               await this.submit(session, payload, "IMAGE_UPDATE");
               break;

            case "ELIMINATE":
               validateHost(session, socket.id);
               await this.eliminate(session, payload);
               break;

            case "NEXT_ROUND":
               validateHost(session, socket.id);
               await this.nextRound(session, config);
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

   async submit(session: any, payload: any, event: string) {
      const { userId, data } = payload;

      // ❌ Prevent duplicate submission
      if (session.roundState.submittedPlayers.includes(userId)) {
         throw new Error("Already submitted");
      }

      session.roundState.submittedPlayers.push(userId);
      session.roundState.submissions[userId] = data;

      await this.emitToHost(session, event, session.roundState.submissions);
   }

   async eliminate(session: any, payload: any) {
      payload.playerIds.forEach((id: string) => {
         const p = session.players.find((x: any) => x.id === id);
         if (p) p.isEliminated = true;
      });

      await this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);

      const alive = session.players.filter((p: any) => !p.isEliminated);

      if (alive.length === 1) {
         await this.endGame(session);
      }
   }
}

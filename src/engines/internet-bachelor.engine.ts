import { BaseEngine } from "./base.engine";
import { validateHost, validatePlayer } from "../middleware/validation";
import { acquireLock } from "../utils/lock";
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

      const locked = await acquireLock(lockKey);
      if (!locked) throw new Error("Another operation in progress");

      switch (type) {
         case "START_GAME":
            validateHost(session, socket.id);
            return this.startGame(session, config);

         case "SUBMIT_ANSWER":
            validatePlayer(session, payload.userId);
            return this.submit(session, payload, "ANSWER_UPDATE");

         case "SUBMIT_IMAGE":
            validatePlayer(session, payload.userId);
            return this.submit(session, payload, "IMAGE_UPDATE");

         case "ELIMINATE":
            validateHost(session, socket.id);
            return this.eliminate(session, payload);

         case "NEXT_ROUND":
            validateHost(session, socket.id);
            return this.nextRound(session, config);
      }

      // 2. SAVE EVENT LOG (immutable history)
      await saveGameEvent({
         gameId: session.id,
         type,
         roundIndex: session.currentRoundIndex,
         payload,
      });

      // 3. SAVE SNAPSHOT (current state)
      await upsertGameSession(session);
   }

   submit(session: any, payload: any, event: string) {
      const { userId, data } = payload;

      // ❌ Prevent duplicate submission
      if (session.roundState.submittedPlayers.includes(userId)) {
         throw new Error("Already submitted");
      }

      session.roundState.submittedPlayers.push(userId);
      session.roundState.submissions[userId] = data;

      this.emitToHost(session, event, session.roundState.submissions);
   }

   eliminate(session: any, payload: any) {
      payload.playerIds.forEach((id: string) => {
         const p = session.players.find((x: any) => x.id === id);
         if (p) p.isEliminated = true;
      });

      this.emitToRoom(session.id, "PLAYERS_UPDATE", session.players);

      const alive = session.players.filter((p: any) => !p.isEliminated);

      if (alive.length === 1) {
         this.endGame(session);
      }
   }
}

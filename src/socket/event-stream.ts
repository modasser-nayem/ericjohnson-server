import { io } from "../config/socket";
import { subscribeEvents } from "../config/pubsub";
import { logger } from "../utils/logger";

let streamInitialized = false;

export const initEventStream = () => {
   if (streamInitialized) return;

   subscribeEvents((event) => {
      const { roomId, type, payload } = event;

      // 🔄 Unified Broadcast Structure: { type, payload }
      io.to(roomId).emit("GAME_EVENT", {
         type,
         payload,
      });
   });

   streamInitialized = true;
   logger.info("Event stream initialized");
};

import { io } from "../config/socket";
import { subscribeEvents } from "../config/pubsub";
import { logger } from "../utils/logger";

let streamInitialized = false;

export const initEventStream = () => {
   if (streamInitialized) return;

   subscribeEvents((event) => {
      const { roomId, type, payload } = event;

      io.to(roomId).emit(type, payload);
   });

   streamInitialized = true;
   logger.info("Event stream initialized");
};

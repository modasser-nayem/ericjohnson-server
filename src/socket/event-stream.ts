import { io } from "../config/socket";
import { subscribeEvents } from "../config/pubsub";

export const initEventStream = () => {
   subscribeEvents((event) => {
      const { roomId, type, payload } = event;

      io.to(roomId).emit(type, payload);
   });
};

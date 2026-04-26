import { redis } from "./redis";
import { logger } from "../utils/logger";

export const pub = redis.duplicate();
export const sub = redis.duplicate();

let isPubSubReady = false;

export const initPubSub = async () => {
   if (isPubSubReady) return;
   await Promise.all([pub.connect(), sub.connect()]);
   isPubSubReady = true;
   logger.info("Redis pub/sub connected");
};

export const publishEvent = async (channel: string, data: any) => {
   if (!isPubSubReady) {
      throw new Error("Pub/Sub not initialized");
   }
   await pub.publish(channel, JSON.stringify(data));
};

export const subscribeEvents = (handler: (data: any) => void) => {
   if (!isPubSubReady) {
      throw new Error("Pub/Sub not initialized");
   }
   sub.subscribe("GAME_EVENTS", (message) => {
      handler(JSON.parse(message));
   });
};

export const closePubSub = async () => {
   if (!isPubSubReady) return;
   await Promise.all([pub.quit(), sub.quit()]);
   isPubSubReady = false;
   logger.info("Redis pub/sub disconnected");
};

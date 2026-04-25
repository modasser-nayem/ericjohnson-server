import { redis } from "./redis";

export const pub = redis.duplicate();
export const sub = redis.duplicate();

await pub.connect();
await sub.connect();

export const publishEvent = async (channel: string, data: any) => {
   await pub.publish(channel, JSON.stringify(data));
};

export const subscribeEvents = (handler: (data: any) => void) => {
   sub.subscribe("GAME_EVENTS", (message) => {
      handler(JSON.parse(message));
   });
};

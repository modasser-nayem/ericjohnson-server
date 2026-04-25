import { redis } from "../config/redis";

export const acquireLock = async (key: string, ttl = 3000) => {
   const lockKey = `lock:${key}`;
   const result = await redis.set(lockKey, "1", {
      NX: true,
      PX: ttl,
   });

   return result === "OK";
};

export const releaseLock = async (key: string) => {
   await redis.del(`lock:${key}`);
};

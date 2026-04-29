import { redis } from "../config/redis";

export const acquireLock = async (key: string, ttl = 5000) => {
   const lockKey = `lock:${key}`;
   const maxRetries = 40; // 40 * 50ms = 2 seconds
   let retries = 0;

   while (retries < maxRetries) {
      const result = await redis.set(lockKey, "1", {
         NX: true,
         PX: ttl,
      });

      if (result === "OK") return true;

      retries++;
      await new Promise((resolve) => setTimeout(resolve, 50));
   }

   return false;
};

export const releaseLock = async (key: string) => {
   await redis.del(`lock:${key}`);
};

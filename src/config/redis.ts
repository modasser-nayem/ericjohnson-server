import { createClient } from "redis";
import { logger } from "../utils/logger";
import env from "./env";

export const redis = createClient({
   url: env.REDIS_URL,
   socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
   },
});

redis.on("error", (error) => {
   logger.error("Redis client error", { error: error.message });
});

export const connectRedis = async () => {
   if (redis.isOpen) return;
   await redis.connect();
   logger.info("Redis connected");
};

export const disconnectRedis = async () => {
   if (!redis.isOpen) return;
   await redis.quit();
   logger.info("Redis disconnected");
};

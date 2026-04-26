import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import { logger } from "../utils/logger";

export const gameQueue = new Queue("gameQueue", {
   connection: redisConnection,
});

// 📤 ADD JOBS
export const addGameJob = async (type: string, data: any) => {
   await gameQueue.add(type, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100,
   });
   logger.info("Game job queued", { type });
};

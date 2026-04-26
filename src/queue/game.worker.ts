import { Job, Worker } from "bullmq";
import { prisma } from "../db/prisma";
import { closeQueueRedis, redisConnection } from "./redis";
import { logger } from "../utils/logger";

let worker: Worker | null = null;

const processJob = async (job: Job) => {
   switch (job.name) {
      case "FINALIZE_GAME":
         await prisma.gameSession.update({
            where: { gameId: job.data.gameId },
            data: {
               status: "ENDED",
               winnerId: job.data.winnerId,
               endedAt: new Date(),
            },
         });
         logger.info("Finalize game job completed", { gameId: job.data.gameId });
         break;
      default:
         logger.warn("Unknown job skipped", { name: job.name });
   }
};

export const initGameWorker = () => {
   if (worker) return;
   worker = new Worker("gameQueue", processJob, { connection: redisConnection });
   worker.on("failed", (job, error) => {
      logger.error("Game worker job failed", {
         name: job?.name,
         error: error.message,
      });
   });
   logger.info("Game worker initialized");
};

export const stopGameWorker = async () => {
   if (!worker) return;
   await worker.close();
   await closeQueueRedis();
   worker = null;
   logger.info("Game worker stopped");
};

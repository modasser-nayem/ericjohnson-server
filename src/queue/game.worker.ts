import { prisma } from "../db/prisma";
import { redisConnection } from "./redis";

new Worker(
   "gameQueue",
   async (job) => {
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

            break;
      }
   },
   { connection: redisConnection },
);

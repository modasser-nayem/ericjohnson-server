import cron from "node-cron";
import { prisma } from "../db/prisma";
import { deleteFileFromCloud } from "../upload/fileUpload";
import { logger } from "./logger";

// Helper function to perform the database cleanup (exported for manual verification in tests)
export const performDatabaseCleanup = async () => {
   logger.info("Starting scheduled database history cleanup...");

   const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
   const TWENTY_FOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);

   try {
      // 1. Delete ended game sessions older than 30 days
      const endedDeleted = await prisma.gameSession.deleteMany({
         where: {
            status: "ENDED",
            updatedAt: { lte: THIRTY_DAYS_AGO }
         }
      });
      logger.info("Cleaned up ended game sessions", { count: endedDeleted.count });

      // 2. Delete orphaned lobby/in-progress game sessions older than 24 hours
      const orphanedDeleted = await prisma.gameSession.deleteMany({
         where: {
            status: { in: ["LOBBY", "IN_PROGRESS"] },
            updatedAt: { lte: TWENTY_FOUR_HOURS_AGO }
         }
      });
      logger.info("Cleaned up orphaned/stuck game sessions", { count: orphanedDeleted.count });

      // 3. Delete all game events older than 30 days
      const eventsDeleted = await prisma.gameEvent.deleteMany({
         where: {
            createdAt: { lte: THIRTY_DAYS_AGO }
         }
      });
      logger.info("Cleaned up old game events", { count: eventsDeleted.count });

   } catch (error: any) {
      logger.error("Database history cleanup failed", { error: error.message });
      throw error;
   }
};

// Cloud Image cleanup: Run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
   try {
      const savedUrls = await prisma.savedImageUrl.findMany({
         where: {
            createdAt: {
               lte: new Date(Date.now() - 12 * 60 * 60 * 1000), // older than 12 hours
            },
         },
      });

      for (const url of savedUrls) {
         try {
            await deleteFileFromCloud(url.url);
            await prisma.savedImageUrl.delete({
               where: { id: url.id },
            });
         } catch (err: any) {
            logger.error("Failed to delete file/db record for image url", { url: url.url, error: err.message });
         }
      }
   } catch (error: any) {
      logger.error("Cloud image cleanup cron failed", { error: error.message });
   }
});

// Database history cleanup: Run every day at midnight (0 0 * * *)
cron.schedule("0 0 * * *", async () => {
   await performDatabaseCleanup().catch(() => {});
});

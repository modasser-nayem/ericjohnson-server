import dotenv from "dotenv";
import { connectRedis, redis } from "./config/redis";
import { prisma } from "./db/prisma";
import { deleteFileFromCloud } from "./upload/fileUpload";
import { performDatabaseCleanup } from "./utils/cronJob";

async function runPurge() {
   console.log("🧹 Starting Immediate Database & Cloud Images Purge Script...");

   // 1. Initialize Redis and Database connection
   try {
      await connectRedis();
      console.log("✅ Connected to Redis.");
   } catch (error: any) {
      console.error("❌ Failed to connect to Redis:", error.message);
      process.exit(1);
   }

   // 2. Perform Database History Cleanup (ended games >30d, stuck lobbies >24h, events >30d)
   try {
      console.log("\n--- Step 1: Cleaning up ended game sessions, stale lobbies, and old events ---");
      await performDatabaseCleanup();
      console.log("✅ Database history cleanup completed.");
   } catch (error: any) {
      console.error("❌ Database history cleanup failed:", error.message);
   }

   // 3. Perform Cloud Image Cleanup (saved URLs >12h)
   try {
      console.log("\n--- Step 2: Cleaning up old uploaded images from cloud storage ---");
      const TWELVE_HOURS_AGO = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      const savedUrls = await prisma.savedImageUrl.findMany({
         where: {
            createdAt: { lte: TWELVE_HOURS_AGO }
         }
      });

      console.log(`Found ${savedUrls.length} cloud images older than 12 hours.`);

      let deleteCount = 0;
      for (const url of savedUrls) {
         try {
            console.log(`Deleting image from cloud: ${url.url}`);
            await deleteFileFromCloud(url.url);
            await prisma.savedImageUrl.delete({
               where: { id: url.id }
            });
            deleteCount++;
         } catch (err: any) {
            console.error(`❌ Failed to delete cloud image or db record for: ${url.url}`, err.message);
         }
      }
      console.log(`✅ Successfully deleted ${deleteCount}/${savedUrls.length} cloud images.`);

   } catch (error: any) {
      console.error("❌ Cloud image cleanup failed:", error.message);
   }

   // Close connections
   await redis.quit();
   console.log("\n🏁 Immediate purge script completed successfully!");
   process.exit(0);
}

runPurge().catch((err) => {
   console.error("Purge script crashed with error:", err);
   process.exit(1);
});

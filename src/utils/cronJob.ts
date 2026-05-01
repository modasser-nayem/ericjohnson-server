// use cront to delete images from cloud after 12 hours
import cron from "node-cron";
import { prisma } from "../db/prisma";
import { deleteFileFromCloud } from "../upload/fileUpload";

cron.schedule("*/5 * * * *", async () => {
   const savedUrls = await prisma.savedImageUrl.findMany({
      where: {
         createdAt: {
            lte: new Date(Date.now() - 12 * 60 * 60 * 1000),
         },
      },
   });
   savedUrls.forEach(async (url) => {
      await deleteFileFromCloud(url.url);
      await prisma.savedImageUrl.delete({
         where: {
            id: url.id,
         },
      });
   });
});

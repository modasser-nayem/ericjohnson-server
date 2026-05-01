import { prisma } from "../db/prisma";
import AppError from "../errors/AppError";
import { uploadFileToCloud } from "../upload/fileUpload";

export const FileService = {
   async uploadFile(file: Express.Multer.File) {
      try {
         const uploadData = await uploadFileToCloud(
            file,
            "file",
            "internet-bachelor",
         );

         await prisma.savedImageUrl.create({
            data: {
               url: uploadData.url,
            },
         });

         return uploadData.url;
      } catch (error: any) {
         throw new AppError(500, error?.message || "File uploaded failed");
      }
   },
};

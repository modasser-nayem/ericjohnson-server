import { FileService } from "../services/file.service";
import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/sendResponse";

export const fileUploadController = catchAsync(
   async (req: Request, res: Response) => {
      const file = req.file as Express.Multer.File;
      if (!file) {
         return res.status(400).json({
            success: false,
            message: "File is required",
         });
      }
      const result = await FileService.uploadFile(file);

      sendResponse(res, {
         success: true,
         statusCode: 201,
         message: "File uploaded successfully",
         data: result,
      });
   },
);

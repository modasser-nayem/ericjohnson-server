import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/sendResponse";
import { UserService } from "../services/user.service";

export const getUserProfileController = catchAsync(
   async (req: Request, res: Response) => {
      const { userId } = req.params;
      const cleanId = String(userId || req.query.userId || "").trim();
      const authHeader = req.headers.authorization;

      const profile = await UserService.getUserProfile(cleanId, authHeader);

      return sendResponse(res, {
         statusCode: 200,
         success: true,
         message: "User profile fetched successfully",
         data: profile,
      });
   },
);

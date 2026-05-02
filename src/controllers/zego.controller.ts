import { Request, Response } from "express";
import env from "../config/env";
import sendResponse from "../utils/sendResponse";
import AppError from "../errors/AppError";
import catchAsync from "../utils/catchAsync";
import { generateToken04 } from "../utils/zegoToken";

export const generateZegoToken = catchAsync(
   async (req: Request, res: Response) => {
      const appId = Number(env.ZEGO_APP_ID);
      const serverSecret = env.ZEGO_APP_SECRET;

      if (!appId || !serverSecret) {
         throw new AppError(503, "Zego is not configured");
      }

      const { userId, roomId } = req.query;

      const resolvedUserId = String(userId || "");
      const resolvedRoomId = String(roomId || "");

      if (!resolvedUserId || !resolvedRoomId) {
         throw new AppError(400, "userId and roomId are required");
      }

      // ⏳ Token valid for 1 hour
      const effectiveTimeInSeconds = 3600;

      const token = generateToken04(
         appId,
         resolvedUserId,
         serverSecret,
         effectiveTimeInSeconds,
         {
            room_id: resolvedRoomId,
            privilege: {
               1: 1,
               2: 1,
            },
         },
      );

      sendResponse(res, {
         statusCode: 200,
         success: true,
         message: "Token generated successfully",
         data: {
            token,
            appId,
            userId: resolvedUserId,
            roomId: resolvedRoomId,
            expiredIn: effectiveTimeInSeconds,
         },
      });
   },
);

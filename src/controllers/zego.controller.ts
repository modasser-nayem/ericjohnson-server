import { Request, Response } from "express";
import crypto from "crypto";
import env from "../config/env";
import sendResponse from "../utils/sendResponse";
import AppError from "../errors/AppError";
import catchAsync from "../utils/catchAsync";

/**
 * Generates a ZegoCloud Token04
 * This implementation follows the official ZegoCloud Token04 algorithm.
 */
export const generateZegoToken = catchAsync(
   async (req: Request, res: Response) => {
      if (!env.ZEGO_APP_ID || !env.ZEGO_APP_SECRET) {
         throw new AppError(503, "Zego is not configured");
      }

      const { userId, roomId } = req.query;
      const resolvedUserId = String(userId ?? "");
      const resolvedRoomId = String(roomId ?? "");

      if (!resolvedUserId || !resolvedRoomId) {
         throw new AppError(
            400,
            "Missing params: userId and roomId are required",
         );
      }

      const appId = Number(env.ZEGO_APP_ID);
      const serverSecret = env.ZEGO_APP_SECRET;

      // Token validity: 1 hour
      const effectiveTimeInSeconds = 3600;
      const expired = Math.floor(Date.now() / 1000) + effectiveTimeInSeconds;
      const nonce = crypto.randomInt(1, 2147483647);

      // Privilege payload (Room login and Stream publish)
      const privilegePayload = JSON.stringify({
         room_id: resolvedRoomId,
         privilege: {
            1: 1, // login
            2: 1, // publish
         },
         stream_id_list: [],
      });

      const tokenData = {
         app_id: appId,
         user_id: resolvedUserId,
         nonce,
         expired,
         payload: privilegePayload,
      };

      const jsonStr = JSON.stringify(tokenData);

      // Encryption: AES-128-CBC
      const iv = crypto.randomBytes(16);
      // Key must be 16 bytes for AES-128. Zego secret is usually 32 chars, we take the first 16.
      const key = Buffer.from(serverSecret).slice(0, 16);

      const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
      let encrypted = Buffer.concat([
         cipher.update(jsonStr, "utf8"),
         cipher.final(),
      ]);

      // Format: 04 + Base64(IV(16 bytes) + CipherTextLength(2 bytes) + CipherText)
      const binaryData = Buffer.alloc(encrypted.length + 18);
      iv.copy(binaryData);
      binaryData.writeUInt16BE(encrypted.length, 16);
      encrypted.copy(binaryData, 18);

      const token = "04" + binaryData.toString("base64");

      sendResponse(res, {
         statusCode: 200,
         success: true,
         message: "Zego token generated successfully",
         data: {
            token,
            appId,
            userId: resolvedUserId,
            roomId: resolvedRoomId,
            expiredAt: new Date(expired * 1000).toISOString(),
         },
      });
   },
);

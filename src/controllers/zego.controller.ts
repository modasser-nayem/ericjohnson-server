import { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";

/**
 * Generates a ZegoCloud Token04
 * This implementation follows the official ZegoCloud Token04 algorithm.
 */
export const generateZegoToken = (req: Request, res: Response) => {
   if (!env.ZEGO_APP_ID || !env.ZEGO_SERVER_SECRET) {
      return res.status(503).json({
         success: false,
         message: "Zego is not configured",
      });
   }

   const { userId, roomId } = req.query;
   const resolvedUserId = String(userId ?? "");
   const resolvedRoomId = String(roomId ?? "");

   if (!resolvedUserId || !resolvedRoomId) {
      return res.status(400).json({
         success: false,
         error: "Missing params: userId and roomId are required",
      });
   }

   try {
      const appId = Number(env.ZEGO_APP_ID);
      const serverSecret = env.ZEGO_SERVER_SECRET;

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

      return res.status(200).json({
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
   } catch (error) {
      console.error("Zego token generation failed:", error);
      return res.status(500).json({
         success: false,
         error: "Internal server error",
      });
   }
};

import { Request, Response } from "express";
import env from "../config/env";
import sendResponse from "../utils/sendResponse";
import AppError from "../errors/AppError";
import catchAsync from "../utils/catchAsync";
import { generateToken04 } from "../utils/zegoToken";
import crypto from "crypto";

// export const generateZegoToken = catchAsync(
//    async (req: Request, res: Response) => {
//       const appId = Number(env.ZEGO_APP_ID);
//       const serverSecret = env.ZEGO_APP_SECRET;

//       if (!appId || !serverSecret) {
//          throw new AppError(503, "Zego is not configured");
//       }

//       const { userId, roomId } = req.query;

//       const resolvedUserId = String(userId || "");
//       const resolvedRoomId = String(roomId || "");

//       if (!resolvedUserId || !resolvedRoomId) {
//          throw new AppError(400, "userId and roomId are required");
//       }

//       // ⏳ Token valid for 1 hour
//       const effectiveTimeInSeconds = 3600;

//       const token = generateToken04(
//          appId,
//          resolvedUserId,
//          serverSecret,
//          effectiveTimeInSeconds,
//          {
//             room_id: resolvedRoomId,
//             privilege: {
//                1: 1,
//                2: 1,
//             },
//          },
//       );

//       sendResponse(res, {
//          statusCode: 200,
//          success: true,
//          message: "Token generated successfully",
//          data: {
//             token,
//             appId,
//             userId: resolvedUserId,
//             roomId: resolvedRoomId,
//             expiredIn: effectiveTimeInSeconds,
//          },
//       });
//    },
// );

export const generateZegoToken = catchAsync(async (req, res) => {
   const appId = Number(env.ZEGO_APP_ID);
   const serverSecret = env.ZEGO_APP_SECRET;

   if (!appId || !serverSecret) {
      throw new AppError(503, "Zego is not configured");
   }

   const { userId, roomId } = req.query;

   const effectiveTimeInSeconds = 3600;
   const createTime = Math.floor(Date.now() / 1000);
   const expire = createTime + effectiveTimeInSeconds;
   const nonce = Math.floor(Math.random() * 2147483647);

   // ✅ IMPORTANT payload format
   const payload = {
      room_id: roomId,
      privilege: {
         1: 1,
         2: 1,
      },
      stream_id_list: [],
   };

   const tokenObj = {
      app_id: appId,
      user_id: userId,
      nonce,
      ctime: createTime,
      expire,
      payload: JSON.stringify(payload),
   };

   const jsonStr = JSON.stringify(tokenObj);

   // ✅ CRITICAL FIX: correct key generation
   const key = crypto.createHash("md5").update(serverSecret).digest();

   const iv = crypto.randomBytes(16);
   const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);

   const encrypted = Buffer.concat([
      cipher.update(jsonStr, "utf8"),
      cipher.final(),
   ]);

   const buffer = Buffer.alloc(16 + 2 + encrypted.length);
   iv.copy(buffer, 0);
   buffer.writeUInt16BE(encrypted.length, 16);
   encrypted.copy(buffer, 18);

   const token = "04" + buffer.toString("base64");

   sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Token generated successfully",
      data: {
         token,
         appId,
         userId,
         roomId,
      },
   });
});

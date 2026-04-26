import { Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";

export const generateZegoToken = (req: Request, res: Response) => {
   if (!env.ZEGO_APP_ID || !env.ZEGO_SERVER_SECRET) {
      return res.status(503).json({ error: "Zego is not configured" });
   }

   const { userId, roomId } = req.query;
   const resolvedUserId = String(userId ?? "");
   const resolvedRoomId = String(roomId ?? "");

   if (!resolvedUserId || !resolvedRoomId) {
      return res.status(400).json({ error: "Missing params" });
   }

   const payload = {
      user_id: resolvedUserId,
      room_id: resolvedRoomId,
      privilege: {
         1: 1, // login
         2: 1, // publish
      },
      expire_time: Math.floor(Date.now() / 1000) + 3600,
   };

   const token = crypto
      .createHmac("sha256", env.ZEGO_SERVER_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

   res.json({
      appId: env.ZEGO_APP_ID,
      token,
   });
};

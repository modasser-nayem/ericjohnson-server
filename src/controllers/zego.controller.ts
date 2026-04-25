import { Request, Response } from "express";
import crypto from "crypto";

const APP_ID = process.env.ZEGO_APP_ID!;
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET!;

export const generateZegoToken = (req: Request, res: Response) => {
   const { userId, roomId } = req.query;

   if (!userId || !roomId) {
      return res.status(400).json({ error: "Missing params" });
   }

   const payload = {
      user_id: userId,
      room_id: roomId,
      privilege: {
         1: 1, // login
         2: 1, // publish
      },
      expire_time: Math.floor(Date.now() / 1000) + 3600,
   };

   const token = crypto
      .createHmac("sha256", SERVER_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

   res.json({
      appId: APP_ID,
      token,
   });
};

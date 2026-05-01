import { redis } from "../config/redis";
import { prisma } from "../db/prisma";

export const recoverGameSession = async (gameId: string) => {
   // 1. Redis (fast path)
   const cached = await redis.get(`game:${gameId}`);
   if (cached) return JSON.parse(cached);

   // 2. MongoDB (source of truth)
   const session = await prisma.gameSession.findUnique({
      where: { gameId },
   });

   if (session) {
      await redis.set(`game:${gameId}`, JSON.stringify(session));
   }

   return session;
};

import { prisma } from "../db/prisma";

// 🧾 Save / update live snapshot
export const upsertGameSession = async (session: any) => {
   try {
      const existing = await prisma.gameSession.findUnique({
         where: { gameId: session.id },
      });

      if (existing) {
         return await prisma.gameSession.update({
            where: { gameId: session.id },
            data: {
               status: session.status,
               currentRoundIndex: session.currentRoundIndex,
               winnerId: session.winnerId,
               players: session.players,
               updatedAt: new Date(),
            },
         });
      } else {
         return await prisma.gameSession.create({
            data: {
               gameId: session.id,
               gameType: session.gameType,
               hostId: session.hostId,
               status: session.status,
               currentRoundIndex: session.currentRoundIndex,
               players: session.players,
            },
         });
      }
   } catch (error) {
      console.error("Failed to upsert game session history:", error);
      return null;
   }
};

// 📜 Save event (audit trail)
export const saveGameEvent = async (event: any) => {
   try {
      return await prisma.gameEvent.create({
         data: event,
      });
   } catch (error) {
      console.error("Failed to save game event history:", error);
      return null;
   }
};

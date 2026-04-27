import { prisma } from "../db/prisma";

// 🧾 Save / update live snapshot
export const upsertGameSession = async (session: any) => {
   console.log("upsertGameSession", session);
   return prisma.gameSession.upsert({
      where: { gameId: session.id },
      update: {
         status: session.status,
         currentRoundIndex: session.currentRoundIndex,
         players: session.players,
         winnerId: session.winnerId,
         updatedAt: new Date(),
      },
      create: {
         gameId: session.id,
         gameType: session.gameType,
         hostId: session.hostId,
         status: session.status,
         currentRoundIndex: session.currentRoundIndex,
         players: session.players,
      },
   });
};

// 📜 Save event (audit trail)
export const saveGameEvent = async (event: any) => {
   return prisma.gameEvent.create({
      data: event,
   });
};

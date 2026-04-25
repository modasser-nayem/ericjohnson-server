export const validateHost = (session: any, socketId: string) => {
   if (session.hostSocketId !== socketId) {
      throw new Error("Only host allowed");
   }
};

export const validatePlayer = (session: any, userId: string) => {
   const player = session.players.find((p: any) => p.id === userId);
   if (!player) throw new Error("Player not in game");
   if (player.isEliminated) throw new Error("Player eliminated");
};

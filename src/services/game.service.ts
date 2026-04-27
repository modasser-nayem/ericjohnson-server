import { redis } from "../config/redis";

const TTL = 60 * 60; // 1 hour

export const saveSession = async (id: string, data: any) => {
   await redis.set(`game:${id}`, JSON.stringify(data), {
      EX: TTL,
   });

   // 📍 Track which user is in which game
   if (data.players) {
      for (const player of data.players) {
         await redis.set(`user_game:${player.id}`, id, { EX: TTL });
      }
   }
   if (data.hostId) {
      await redis.set(`user_game:${data.hostId}`, id, { EX: TTL });
   }
};

export const getSession = async (id: string) => {
   const data = await redis.get(`game:${id}`);
   return data ? JSON.parse(data) : null;
};

export const getUserActiveGame = async (userId: string) => {
   return await redis.get(`user_game:${userId}`);
};

export const removeUserFromGameMapping = async (userId: string) => {
   await redis.del(`user_game:${userId}`);
};

export const saveSnapshot = async (gameId: string, session: any) => {
   await redis.set(`snapshot:${gameId}`, JSON.stringify(session));
};

export const getSnapshot = async (gameId: string) => {
   const data = await redis.get(`snapshot:${gameId}`);
   return data ? JSON.parse(data) : null;
};

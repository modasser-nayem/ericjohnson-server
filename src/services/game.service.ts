import { redis } from "../config/redis";

const TTL = 60 * 60; // 1 hour

export const saveSession = async (id: string, data: any) => {
   await redis.set(`game:${id}`, JSON.stringify(data), {
      EX: TTL,
   });
};

export const getSession = async (id: string) => {
   const data = await redis.get(`game:${id}`);
   return data ? JSON.parse(data) : null;
};

export const saveSnapshot = async (gameId: string, session: any) => {
   await redis.set(`snapshot:${gameId}`, JSON.stringify(session));
};

export const getSnapshot = async (gameId: string) => {
   const data = await redis.get(`snapshot:${gameId}`);
   return data ? JSON.parse(data) : null;
};

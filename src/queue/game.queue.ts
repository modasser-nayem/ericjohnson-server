import { Queue, Worker } from "bullmq";
import { redisConnection } from "./redis";
import { createGameSession, saveRound } from "../services/game-history.service";

export const gameQueue = new Queue("gameQueue", {
   connection: redisConnection,
});

// 📤 ADD JOBS
export const addGameJob = async (type: string, data: any) => {
   await gameQueue.add(type, data);
};

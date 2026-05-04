import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { connectRedis, redis } from "./redis";
import { registerSocketHandlers } from "../socket/handlers";
import { initPubSub } from "./pubsub";
import { logger } from "../utils/logger";
import env from "./env";

export let io: Server;
let adapterPubClient: ReturnType<typeof redis.duplicate> | null = null;
let adapterSubClient: ReturnType<typeof redis.duplicate> | null = null;

export const initSocket = async (server: HttpServer) => {
   await connectRedis();
   await initPubSub();

   io = new Server(server, {
      cors: {
         origin: [
            env.FRONTEND_URL,
            "http://164.92.85.75:3041",
            "http://localhost:3000",
            "http://localhost:3041",
         ],
         credentials: true,
      },
   });

   adapterPubClient = redis.duplicate();
   adapterSubClient = redis.duplicate();

   await Promise.all([adapterPubClient.connect(), adapterSubClient.connect()]);

   io.adapter(createAdapter(adapterPubClient, adapterSubClient));

   registerSocketHandlers(io);
   logger.info("Socket server initialized");
};

export const closeSocket = async () => {
   if (adapterPubClient?.isOpen) {
      await adapterPubClient.quit();
   }
   if (adapterSubClient?.isOpen) {
      await adapterSubClient.quit();
   }
   if (io) {
      await io.close();
   }
   logger.info("Socket server closed");
};

import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "./redis";
import { registerSocketHandlers } from "../socket/handlers";

export let io: Server;

export const initSocket = async (server: any) => {
   io = new Server(server, {
      cors: { origin: "*" },
   });

   const pubClient = redis.duplicate();
   const subClient = redis.duplicate();

   await Promise.all([pubClient.connect(), subClient.connect()]);

   io.adapter(createAdapter(pubClient, subClient));

   registerSocketHandlers(io);
};

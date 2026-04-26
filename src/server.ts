import { createServer } from "http";
import app from "./app";
import { closeSocket, initSocket } from "./config/socket";
import { env } from "./config/env";
import { initEventStream } from "./socket/event-stream";
import { logger } from "./utils/logger";
import { disconnectRedis } from "./config/redis";
import { closePubSub } from "./config/pubsub";
import { disconnectPrisma } from "./db/prisma";
import { initGameWorker, stopGameWorker } from "./queue/game.worker";

const startServer = async () => {
   const server = createServer(app);

   await initSocket(server);
   initEventStream();
   initGameWorker();

   server.listen(env.PORT, () => {
      logger.info("Server running", { port: env.PORT, nodeEnv: env.NODE_ENV });
   });

   const shutdown = async (signal: string) => {
      logger.info("Shutdown requested", { signal });
      server.close();
      await stopGameWorker();
      await closeSocket();
      await closePubSub();
      await disconnectRedis();
      await disconnectPrisma();
      process.exit(0);
   };

   process.on("SIGINT", () => {
      void shutdown("SIGINT");
   });
   process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
   });
};

startServer().catch((error) => {
   logger.error("Failed to start server", { error: error.message });
   process.exit(1);
});

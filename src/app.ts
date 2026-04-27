import express from "express";
import { generateZegoToken } from "./controllers/zego.controller";
import { register, login } from "./controllers/auth.controller";
import { registerMetrics } from "./metrics";
import { redis } from "./config/redis";
import { prisma } from "./db/prisma";

const app = express();

app.use(express.json());

app.get("/", (_, res) => {
   res.send("Game server running");
});

app.get("/health", (_, res) => {
   res.status(200).json({ status: "ok, hay" });
});

app.get("/ready", async (_, res) => {
   try {
      if (!redis.isOpen) {
         return res.status(503).json({ status: "redis_not_ready" });
      }
      await prisma.$runCommandRaw({ ping: 1 });
      return res.status(200).json({ status: "ready" });
   } catch {
      return res.status(503).json({ status: "db_not_ready" });
   }
});

app.get("/zego-token", generateZegoToken);

app.post("/auth/register", register);
app.post("/auth/login", login);

app.get("/metrics", async (_, res) => {
   res.setHeader("Content-Type", registerMetrics.contentType);
   res.send(await registerMetrics.metrics());
});

export default app;

import express from "express";
import cors from "cors";
import { generateZegoToken } from "./controllers/zego.controller";
import { register, login } from "./controllers/auth.controller";
import { registerMetrics } from "./metrics";
import { redis } from "./config/redis";
import { prisma } from "./db/prisma";

const app = express();

app.use(
   cors({
      origin: ["http://localhost:3000", "http://localhost:3040"],
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
   }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

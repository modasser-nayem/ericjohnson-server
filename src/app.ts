import express from "express";
import { generateZegoToken } from "./controllers/zego.controller";
import { registerMetrics } from "./metrics";

const app = express();

app.use(express.json());

app.get("/", (_, res) => {
   res.send("Game server running");
});

app.get("/zego-token", generateZegoToken);

app.get("/metrics", async (_, res) => {
   res.setHeader("Content-Type", registerMetrics.contentType);
   res.send(await registerMetrics.metrics());
});

export default app;

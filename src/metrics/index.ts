import client from "prom-client";

export const registerMetrics = new client.Registry();

client.collectDefaultMetrics({ register: registerMetrics });

// CUSTOM METRICS
export const gamesStarted = new client.Counter({
   name: "games_started_total",
   help: "Total games started",
});

export const activePlayers = new client.Gauge({
   name: "active_players",
   help: "Current active players",
});

registerMetrics.registerMetric(gamesStarted);
registerMetrics.registerMetric(activePlayers);

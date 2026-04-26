import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { getSession, saveSession } from "../services/game.service";
import { GameRegistry } from "../core/game-registry";
import { GameConfigRegistry } from "../core/game-config";
import { withAck } from "../utils/ack";
import { rateLimit } from "../middleware/rate-limit";
import { recoverGameSession } from "../services/recovery.service";
import { logger } from "../utils/logger";
import { activePlayers, gamesStarted } from "../metrics";
import { redis } from "../config/redis";

export const registerSocketHandlers = (io: Server) => {
   io.on("connection", (socket: Socket) => {
      // 🔁 RECONNECT STATE SYNC
      socket.on("RECONNECT_GAME", async ({ gameId, userId }, ack) => {
         await withAck(async () => {
            const session = await recoverGameSession(gameId);
            if (!session) throw new Error("Game not found");

            const player = session.players.find((p: any) => p.id === userId);

             if (player) {
                player.socketId = socket.id; // 🔁 update socket
                player.isConnected = true;
                player.hasNetworkIssue = false;
             }

            socket.join(gameId);

            // 🔥 full resume state
            return {
               session,
               currentRound: session.currentRoundIndex,
               roundState: session.roundState,
            };
         }, ack);
      });

      socket.on("CREATE_GAME", async ({ gameType, userId }, ack) => {
         await withAck(async () => {
            const gameId = uuid();

            const session = {
               id: gameId,
               gameType,
               hostId: userId,
               hostSocketId: socket.id,
               players: [],
               status: "LOBBY",
            };

            await saveSession(gameId, session);

            socket.join(gameId);
            gamesStarted.inc();

            return { gameId };
         }, ack);
      });

      socket.on("JOIN_GAME", async ({ gameId, userId }, ack) => {
         await withAck(async () => {
            const session = await getSession(gameId);
            if (!session) throw new Error("Game not found");

            const existing = session.players.find((p: any) => p.id === userId);

             if (!existing) {
                session.players.push({
                   id: userId,
                   socketId: socket.id,
                   isEliminated: false,
                   isReady: false,
                   isConnected: true,
                   hasNetworkIssue: false
                });
             } else {
                existing.socketId = socket.id;
                existing.isConnected = true;
                existing.hasNetworkIssue = false;
             }

            socket.join(gameId);

            await saveSession(gameId, session);

            io.to(gameId).emit("PLAYER_JOINED", session.players);
            activePlayers.set(session.players.length);

            return session;
         }, ack);
      });

      socket.on("GAME_EVENT", async (data, ack) => {
         await withAck(async () => {
            rateLimit(socket.id, "GAME_EVENT");

            const { gameId, type, payload } = data;

            const session = await getSession(gameId);
            if (!session) throw new Error("Game not found");

            const engine = GameRegistry[session.gameType];
            const config = GameConfigRegistry[session.gameType];
            if (!engine || !config) {
               throw new Error(`Unsupported game type: ${session.gameType}`);
            }

            await engine.handleEvent(type, payload, session, config, socket);

            await saveSession(gameId, session);

            return { ok: true };
         }, ack);
      });

      socket.on("disconnect", async () => {
         logger.info("Socket disconnected", { socketId: socket.id });

         // 🔌 Handle disconnect logic for games
         // We can find the session this socket belonged to and update player status
         const activeGames = await redis.keys("game:*");
         for (const key of activeGames) {
            const gameId = key.split(":")[1];
            const session = await getSession(gameId);
            if (!session) continue;

            const player = session.players.find((p: any) => p.socketId === socket.id);
            if (player) {
               player.isConnected = false;
               player.hasNetworkIssue = true;
               
               await saveSession(gameId, session);
               io.to(gameId).emit("PLAYER_NETWORK_ISSUE", { 
                  userId: player.id, 
                  message: `Player ${player.id} network issues` 
               });
               io.to(gameId).emit("PLAYERS_UPDATE", session.players);
            }
         }
      });
   });
};

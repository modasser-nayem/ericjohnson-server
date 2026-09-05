import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import {
   getSession,
   saveSession,
   getUserActiveGame,
   removeUserFromGameMapping,
} from "../services/game.service";
import { addGameJob } from "../queue/game.queue";
import { GameRegistry } from "../core/game-registry";
import { GameConfigRegistry } from "../core/game-config";
import { withAck } from "../utils/ack";
import { rateLimit } from "../middleware/rate-limit";
import { recoverGameSession } from "../services/recovery.service";
import { logger } from "../utils/logger";
import { activePlayers, gamesStarted } from "../metrics";
import { redis } from "../config/redis";
import { AuthService } from "../services/auth.service";

// ── Short room code helpers ─────────────────────────────────────────────────
function generateRoomCode(): string {
   const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars
   let code = "";
   for (let i = 0; i < 6; i++)
      code += chars[Math.floor(Math.random() * chars.length)];
   return code;
}

const resolveGameId = async (codeOrId: string): Promise<string | null> => {
   // Full UUID → use directly
   if (codeOrId.length > 10) return codeOrId;
   // Short code → look up in Redis
   const gameId = await redis.get("roomcode:" + codeOrId.toUpperCase());
   return gameId || null;
};
// ────────────────────────────────────────────────────────────────────────────

export const getActiveRooms = async () => {
   const keys = await redis.keys("game:*");
   const rooms = [];
   const now = Date.now();
   for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
         try {
            const session = JSON.parse(data);
            if (session && session.status === "LOBBY") {
               // 🧹 Garbage collect abandoned lobbies:
               // 1. Host disconnected > 60s ago
               // 2. Created > 15 minutes ago
               const isHostDisconnectedStale =
                  session.isHostConnected === false &&
                  session.hostDisconnectedAt &&
                  now - session.hostDisconnectedAt > 60000;
               const isOlderThan15Min =
                  session.createdAt && now - session.createdAt > 15 * 60 * 1000;

               if (isHostDisconnectedStale || isOlderThan15Min) {
                  session.status = "ENDED";
                  await saveSession(session.id, session);
                  continue; // Skip returning this stale room
               }

               rooms.push({
                  gameId: session.id,
                  gameType: session.gameType,
                  hostId: session.hostId,
                  status: session.status,
                  playerCount: session.players ? session.players.length : 0,
               });
            }
         } catch (e: any) {
            logger.error("Failed to parse game session for key: " + key, {
               error: e.message,
            });
         }
      }
   }
   return rooms;
};

export const broadcastActiveRooms = async (io: Server) => {
   try {
      const rooms = await getActiveRooms();
      io.emit("ROOMS_UPDATE", rooms);
   } catch (error: any) {
      logger.error("Failed to broadcast active rooms", {
         error: error.message,
      });
   }
};

export const leavePreviousGame = async (userId: string, io: Server) => {
   const activeGameId = await getUserActiveGame(userId);
   if (!activeGameId) return;

   const oldSession = await getSession(activeGameId);
   if (!oldSession) return;

   let oldGameChanged = false;

   if (oldSession.hostId === userId) {
      // User was host. End the game room!
      if (oldSession.status !== "ENDED") {
         oldSession.status = "ENDED";
         await saveSession(activeGameId, oldSession);
         await addGameJob("FINALIZE_GAME", {
            gameId: activeGameId,
            winnerId: null,
         });

         // Emit network status and game ended to the old room
         io.to(activeGameId).emit("GAME_EVENT", {
            type: "NETWORK_STATUS",
            payload: {
               userId,
               isConnected: false,
               isHost: true,
               message: "Host left to join or create another game",
            },
         });
         io.to(activeGameId).emit("GAME_EVENT", {
            type: "GAME_ENDED",
            payload: { winner: null, noWinner: true },
         });

         // Force all sockets in the old room to leave
         io.in(activeGameId).socketsLeave(activeGameId);

         oldGameChanged = true;
      }
   } else {
      // User was player. Remove them from player list.
      const oldPlayer = oldSession.players.find((p: any) => p.id === userId);
      const initialLength = oldSession.players.length;
      oldSession.players = oldSession.players.filter(
         (p: any) => p.id !== userId,
      );

      if (oldSession.players.length !== initialLength) {
         await saveSession(activeGameId, oldSession);

         // Notify the old room
         io.to(activeGameId).emit("GAME_EVENT", {
            type: "NETWORK_STATUS",
            payload: {
               userId,
               isConnected: false,
               isHost: false,
               message: "User left to join or create another game",
            },
         });
         io.to(activeGameId).emit("GAME_EVENT", {
            type: "PLAYERS_UPDATE",
            payload: oldSession.players,
         });

         if (oldPlayer && oldPlayer.socketId) {
            io.in(oldPlayer.socketId).socketsLeave(activeGameId);
         }

         oldGameChanged = true;
      }
   }

   // Clean user game mapping
   await removeUserFromGameMapping(userId);

   if (oldGameChanged) {
      await broadcastActiveRooms(io);
   }
};

export const registerSocketHandlers = (io: Server) => {
   // 🛡️ AUTH MIDDLEWARE
   io.use(async (socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) return next(new Error("Authentication error"));

      try {
         // 1. Try online verification
         const userId = await AuthService.verifyTokenOnline(token);
         if (userId) {
            (socket as any).userId = userId;
            return next();
         }

         // 2. Fallback to local decryption (keeps integration tests and local setups working)
         const decoded = AuthService.verifyToken(token);
         if (decoded && decoded.userId) {
            (socket as any).userId = decoded.userId;
            return next();
         }
      } catch (error: any) {
         logger.error("Authentication middleware error", {
            error: error.message,
         });
      }

      return next(new Error("Authentication error"));
   });

   io.on("connection", (socket: Socket) => {
      // Send initial active rooms to the newly connected client
      getActiveRooms()
         .then((rooms) => {
            socket.emit("ROOMS_UPDATE", rooms);
         })
         .catch((err) => {
            logger.error("Failed to send initial active rooms", {
               error: err.message,
            });
         });

      // Listen for manual request for active rooms list
      socket.on("GET_ACTIVE_ROOMS", async (ack) => {
         await withAck(async () => {
            const rooms = await getActiveRooms();
            return rooms;
         }, ack);
      });

      // 🔁 RECONNECT STATE SYNC
      socket.on("RECONNECT_GAME", async ({ gameId }, ack) => {
         await withAck(async () => {
            const userId = (socket as any).userId;
            const realGameId = (await resolveGameId(gameId)) || gameId;

            // 🧠 SMART RECONNECT: Handle users switching games
            const activeGameId = await getUserActiveGame(userId);
            if (activeGameId && activeGameId !== realGameId) {
               await leavePreviousGame(userId, io);
            }

            const session = await recoverGameSession(realGameId);
            if (!session) throw new Error("Game not found");
            if (session.status === "ENDED")
               throw new Error("Game has already ended");

            const player = session.players.find((p: any) => p.id === userId);

            if (player) {
               player.socketId = socket.id; // 🔁 update socket
               player.isConnected = true;
               player.hasNetworkIssue = false;
            }

            // 🛡️ Update Host Socket ID & Connection state if the host is reconnecting
            if (session.hostId === userId) {
               session.hostSocketId = socket.id;
               session.isHostConnected = true;
               delete session.hostDisconnectedAt;
            }

            socket.join(realGameId);

            await saveSession(realGameId, session);

            io.to(realGameId).emit("GAME_EVENT", {
               type: "NETWORK_STATUS",
               payload: {
                  userId,
                  isConnected: true,
                  isHost: session.hostId === userId,
                  message: `User ${userId} reconnected`,
               },
            });
            io.to(realGameId).emit("GAME_EVENT", {
               type: "PLAYERS_UPDATE",
               payload: session.players,
            });

            // 🔥 full resume state
            return {
               session,
               currentRound: session.currentRoundIndex,
               roundState: session.roundState,
               gameId: realGameId,
            };
         }, ack);
      });

      socket.on("CREATE_GAME", async ({ gameType }, ack) => {
         await withAck(async () => {
            const userId = (socket as any).userId;
            await leavePreviousGame(userId, io);

            const gameId = uuid();

            const session = {
               id: gameId,
               gameType,
               hostId: userId,
               hostSocketId: socket.id,
               isHostConnected: true,
               createdAt: Date.now(),
               players: [],
               status: "LOBBY",
            };

            await saveSession(gameId, session);

            socket.join(gameId);
            gamesStarted.inc();

            await broadcastActiveRooms(io);

            return { gameId };
         }, ack);
      });

      socket.on("JOIN_GAME", async ({ gameId, name, avatar }, ack) => {
         await withAck(async () => {
            const userId = (socket as any).userId;
            const realGameId = (await resolveGameId(gameId)) || gameId;

            // 🧠 SMART JOIN: Remove from other games first
            const activeGameId = await getUserActiveGame(userId);
            if (activeGameId && activeGameId !== realGameId) {
               await leavePreviousGame(userId, io);
            }

            const session = await getSession(realGameId);
            if (!session) throw new Error("Game not found");

            let player = session.players.find((p: any) => p.id === userId);

            if (!player) {
               player = {
                  id: userId,
                  socketId: socket.id,
                  name,
                  avatar,
                  isEliminated: false,
                  isReady: false,
                  isConnected: true,
                  hasNetworkIssue: false,
                  points: 0,
                  hasSubmitted: false,
               };
               session.players.push(player);
            } else {
               // Update socket and connection status on reconnect
               player.socketId = socket.id;
               player.isConnected = true;
               player.hasNetworkIssue = false;
               // Update cosmetic info if provided
               if (name) player.name = name;
               if (avatar) player.avatar = avatar;
            }

            socket.join(realGameId);

            await saveSession(realGameId, session);

            io.to(realGameId).emit("GAME_EVENT", {
               type: "NETWORK_STATUS",
               payload: {
                  userId,
                  isConnected: true,
                  isHost: session.hostId === userId,
                  message: `User ${userId} joined`,
               },
            });
            io.to(realGameId).emit("GAME_EVENT", {
               type: "PLAYERS_UPDATE",
               payload: session.players,
            });
            activePlayers.set(session.players.length);

            await broadcastActiveRooms(io);

            return { ...session, gameId: realGameId };
         }, ack);
      });

      socket.on("GAME_EVENT", async (data, ack) => {
         await withAck(async () => {
            rateLimit(socket.id, "GAME_EVENT");

            const { gameId, type, payload } = data;
            const realGameId = (await resolveGameId(gameId)) || gameId;

            const session = await getSession(realGameId);
            if (!session) throw new Error("Game not found");

            const engine = GameRegistry[session.gameType];
            const config = GameConfigRegistry[session.gameType];
            if (!engine || !config) {
               throw new Error(`Unsupported game type: ${session.gameType}`);
            }

            // Get userId from socket (set by auth middleware)
            const userId = (socket as any).userId;

            const previousStatus = session.status;
            const previousPlayerCount = session.players?.length || 0;

            await engine.handleEvent(
               type,
               payload,
               session,
               config,
               socket,
               userId,
            );

            await saveSession(realGameId, session);

            if (
               session.status !== previousStatus ||
               (session.players?.length || 0) !== previousPlayerCount
            ) {
               await broadcastActiveRooms(io);
            }

            return { ok: true };
         }, ack);
      });

      socket.on("disconnect", async () => {
         logger.info("Socket disconnected", { socketId: socket.id });

         const activeGames = await redis.keys("game:*");
         let roomsChanged = false;
         for (const key of activeGames) {
            const gameId = key.split(":")[1];
            const session = await getSession(gameId);
            if (!session || session.status === "ENDED") continue;

            const isHost = session.hostSocketId === socket.id;
            const player = session.players?.find(
               (p: any) => p.socketId === socket.id,
            );

            // 👑 1. HOST DISCONNECT
            if (isHost) {
               session.isHostConnected = false;
               session.hostDisconnectedAt = Date.now();
               await saveSession(gameId, session);

               io.to(gameId).emit("GAME_EVENT", {
                  type: "NETWORK_STATUS",
                  payload: {
                     userId: session.hostId,
                     isConnected: false,
                     isHost: true,
                     message: "Host connection lost",
                  },
               });

               // ⏱ 60s Host Grace Period Timer
               setTimeout(async () => {
                  const liveSession = await getSession(gameId);
                  if (!liveSession || liveSession.status === "ENDED") return;
                  if (liveSession.isHostConnected === false) {
                     logger.info(
                        `Host grace period expired for game ${gameId}. Ending game.`,
                     );
                     liveSession.status = "ENDED";
                     await saveSession(gameId, liveSession);
                     await addGameJob("FINALIZE_GAME", {
                        gameId,
                        winnerId: null,
                     });

                     io.to(gameId).emit("GAME_EVENT", {
                        type: "GAME_ENDED",
                        payload: {
                           winner: null,
                           noWinner: true,
                           reason: "Host disconnected",
                        },
                     });
                     await broadcastActiveRooms(io);
                  }
               }, 60000);

               roomsChanged = true;
            }

            // 👤 2. PLAYER DISCONNECT
            if (player) {
               player.isConnected = false;
               player.hasNetworkIssue = true;

               await saveSession(gameId, session);
               io.to(gameId).emit("GAME_EVENT", {
                  type: "NETWORK_STATUS",
                  payload: {
                     userId: player.id,
                     isConnected: false,
                     isHost: false,
                     message: `User ${player.id} disconnected`,
                  },
               });
               io.to(gameId).emit("GAME_EVENT", {
                  type: "PLAYERS_UPDATE",
                  payload: session.players,
               });

               // If in progress, re-evaluate round completion & remaining players
               if (session.status === "IN_PROGRESS") {
                  const engine = GameRegistry[session.gameType];
                  if (engine && typeof engine.checkRoundCompletion === "function") {
                     await engine.checkRoundCompletion(session);
                     await saveSession(gameId, session);
                  }
               }

               roomsChanged = true;
            }
         }
         if (roomsChanged) {
            await broadcastActiveRooms(io);
         }
      });
   });
};

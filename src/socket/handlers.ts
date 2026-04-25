import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { getSession, saveSession } from "../services/game.service";
import { GameRegistry } from "../core/game-registry";
import { GameConfigRegistry } from "../core/game-config";
import { withAck } from "../utils/ack";
import { rateLimit } from "../middleware/rate-limit";
import { recoverGameSession } from "../services/recovery.service";

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
               });
            }

            socket.join(gameId);

            await saveSession(gameId, session);

            io.to(gameId).emit("PLAYER_JOINED", session.players);

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

            engine.handleEvent(type, payload, session, config, socket);

            await saveSession(gameId, session);

            return { ok: true };
         }, ack);
      });

      socket.on("disconnect", () => {
         console.log("Disconnected:", socket.id);
      });
   });
};

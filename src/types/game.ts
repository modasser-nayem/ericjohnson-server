export type GameStatus = "LOBBY" | "IN_PROGRESS" | "ENDED";

export interface Player {
   id: string;
   socketId: string;
   name?: string;
   avatar?: string;
   isReady: boolean;
   isEliminated: boolean;
   isConnected: boolean;
   hasNetworkIssue: boolean;
   points: number;
   hasSubmitted: boolean;
}

export interface RoundConfig {
   type: "QUESTION" | "IMAGE" | "VIDEO";
   nextAtCount: number;
   /**
    * When true, the host may call DECLARE_NEITHER to end the round
    * with no winner instead of being forced to pick one finalist.
    * The minimum remaining-player count for this to be valid is
    * derived from nextAtCount (remaining > nextAtCount).
    */
   allowNeither?: boolean;
   /**
    * How long (ms) before ROUND_TIMEOUT fires automatically.
    * Set to 0 to disable the timeout entirely (e.g. VIDEO rounds
    * are fully host-driven via CALL_PLAYER / END_CALL).
    * Defaults to 60 000 ms if omitted.
    */
   timeoutMs?: number;
}

export interface GameConfig {
   minPlayers: number;
   maxPlayers: number;
   rounds: RoundConfig[];
}

export interface RoundState {
   currentQuestion?: string;
   submissions: any[];
   submittedPlayers: string[];
   startTime: number;
}

export interface GameSession {
   id: string;
   gameType: string;
   hostId: string;
   hostSocketId: string;
   isHostConnected?: boolean;
   hostDisconnectedAt?: number;
   createdAt?: number;
   players: Player[];
   status: GameStatus;
   currentRoundIndex: number;
   roundState: RoundState;
   winnerId: string | null;
}

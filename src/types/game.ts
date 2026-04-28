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
}

export interface RoundConfig {
   type: "QUESTION" | "IMAGE" | "VIDEO";
   nextAtCount: number;
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
   players: Player[];
   status: GameStatus;
   currentRoundIndex: number;
   roundState: RoundState;
   winnerId: string | null;
}

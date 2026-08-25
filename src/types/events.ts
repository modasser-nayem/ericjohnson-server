export type GameEventType =
   | "PLAYER_READY"
   | "START_GAME"
   | "SEND_QUESTION"
   | "TYPING"
   | "SUBMIT_DATA"
   | "ELIMINATE"
   | "NEXT_ROUND"
   | "NETWORK_STATUS"
   | "PLAYERS_UPDATE"
   | "NEW_QUESTION"
   | "DATA_UPDATE"
   | "CAN_NEXT"
   | "ROUND_STARTED"
   | "GAME_ENDED"
   | "USER_TYPING"
   | "EXIT_GAME"
   | "ANSWER_SUBMITTED"
   | "CALL_PLAYER"
   | "ACCEPT_CALL"
   | "REJECT_CALL"
   | "END_CALL"
   | "INCOMING_CALL"
   | "CALL_ACCEPTED"
   | "CALL_REJECTED"
   | "CALL_ENDED"
   | "DECLARE_NEITHER"
   | "REMOVE_PLAYER"
   | "KICKED";

export interface GameEventPayloadMap {
   PLAYER_READY: {};
   START_GAME: {};
   SEND_QUESTION: { question: string };
   TYPING: { isTyping: boolean };
   SUBMIT_DATA: { data: any; answer?: string };
   ANSWER_SUBMITTED: { userId: string; data: any; allSubmissions: any[] };
   ELIMINATE: { playerIds: string[]; points?: number; winnerPoints?: number };
   NEXT_ROUND: {};
   EXIT_GAME: {};
   CALL_PLAYER: { userId: string };
   ACCEPT_CALL: {};
   REJECT_CALL: {};
   END_CALL: { userId: string };
   INCOMING_CALL: { hostId: string };
   CALL_ACCEPTED: { userId: string };
   CALL_REJECTED: { userId: string };
   CALL_ENDED: { hostId: string };
   NETWORK_STATUS: {
      userId: string;
      isConnected: boolean;
      isHost: boolean;
      message: string;
   };
   PLAYERS_UPDATE: any[];
   NEW_QUESTION: { question: string };
   DATA_UPDATE: any;
   CAN_NEXT: { nextRoundIndex: number; label: string };
   ROUND_STARTED: any;
   /** winner is null when the host declares "Neither" in the final round */
   GAME_ENDED: { winner: any | null; noWinner?: boolean };
   USER_TYPING: { userId: string; isTyping: boolean };
   /** Host-only: reject both finalists — no winner is declared */
   DECLARE_NEITHER: {};
   REMOVE_PLAYER: { userId: string };
   KICKED: { gameId: string; message: string };
}

export interface StandardEvent<T extends GameEventType> {
   type: T;
   payload: GameEventPayloadMap[T];
}

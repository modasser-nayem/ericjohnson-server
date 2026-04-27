export type GameEventType =
   | "PLAYER_READY"
   | "START_GAME"
   | "SEND_QUESTION"
   | "TYPING"
   | "SUBMIT_DATA"
   | "ELIMINATE"
   | "NEXT_ROUND"
   | "HOST_ACTION"
   | "NETWORK_STATUS"
   | "PLAYERS_UPDATE"
   | "NEW_QUESTION"
   | "DATA_UPDATE"
   | "CAN_NEXT"
   | "ROUND_STARTED"
   | "ROUND_ACTION"
   | "GAME_ENDED"
   | "USER_TYPING";

export interface GameEventPayloadMap {
   PLAYER_READY: { userId: string };
   START_GAME: {};
   SEND_QUESTION: { question: string };
   TYPING: { userId: string; isTyping: boolean };
   SUBMIT_DATA: { userId: string; data: any; answer?: string };
   ELIMINATE: { playerIds: string[] };
   NEXT_ROUND: {};
   HOST_ACTION: { action: string; [key: string]: any };
   NETWORK_STATUS: { userId: string; isConnected: boolean; isHost: boolean; message: string };
   PLAYERS_UPDATE: any[];
   NEW_QUESTION: { question: string };
   DATA_UPDATE: any;
   CAN_NEXT: { nextRoundIndex: number; label: string };
   ROUND_STARTED: any;
   ROUND_ACTION: any;
   GAME_ENDED: { winner: any };
   USER_TYPING: { userId: string; isTyping: boolean };
}

export interface StandardEvent<T extends GameEventType> {
   type: T;
   payload: GameEventPayloadMap[T];
}

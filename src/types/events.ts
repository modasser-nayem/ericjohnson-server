export type GameEventType =
   | "START_GAME"
   | "SUBMIT_ANSWER"
   | "SUBMIT_IMAGE"
   | "ELIMINATE"
   | "NEXT_ROUND";

export interface GameEventPayloadMap {
   START_GAME: {};
   SUBMIT_ANSWER: { userId: string; data: string };
   SUBMIT_IMAGE: { userId: string; data: string };
   ELIMINATE: { playerIds: string[] };
   NEXT_ROUND: {};
}

export interface GameEvent<T extends GameEventType> {
   gameId: string;
   type: T;
   payload: GameEventPayloadMap[T];
}

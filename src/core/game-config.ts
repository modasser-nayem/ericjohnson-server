export const GameConfigRegistry: any = {
   INTERNET_BACHELOR: {
      minPlayers: 4,
      maxPlayers: 10,
      rounds: [
         // Round 1: 4 players start → eliminate 1 → 3 advance
         // 120s for players to type their answers
         { type: "QUESTION", nextAtCount: 3, timeoutMs: 120000 },
         // Round 2: 3 players → eliminate 1 → 2 advance
         // 180s for photo capture + upload
         { type: "IMAGE", nextAtCount: 2, timeoutMs: 180000 },
         // Round 3 (Final): 2 finalists → video calls → eliminate 1 → winner
         // 0 = no automatic timeout; host controls pace via CALL_PLAYER / END_CALL
         { type: "VIDEO", nextAtCount: 1, allowNeither: true, timeoutMs: 0 },
      ],
   },
};


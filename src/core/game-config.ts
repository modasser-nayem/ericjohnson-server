export const GameConfigRegistry: any = {
   INTERNET_BACHELOR: {
      minPlayers: 4,
      maxPlayers: 10,
      rounds: [
         // Round 1: 4 players start → eliminate 1 → 3 advance
         { type: "QUESTION", nextAtCount: 3 },
         // Round 2: 3 players → eliminate 1 → 2 advance
         { type: "IMAGE", nextAtCount: 2 },
         // Round 3 (Final): 2 finalists → video calls → eliminate 1 → winner
         { type: "VIDEO", nextAtCount: 1, allowNeither: true },
      ],
   },
};


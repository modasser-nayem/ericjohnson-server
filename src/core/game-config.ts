export const GameConfigRegistry: any = {
   INTERNET_BACHELOR: {
      minPlayers: 4,
      maxPlayers: 10,
      rounds: [
         { type: "QUESTION", nextAtCount: 3 },
         { type: "IMAGE", nextAtCount: 2 },
         { type: "VIDEO", nextAtCount: 1 },
      ],
   },
};

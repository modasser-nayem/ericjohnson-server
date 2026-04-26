export const GameConfigRegistry: any = {
   INTERNET_BACHELOR: {
      minPlayers: 4,
      maxPlayers: 10,
      rounds: [
         { type: "QUESTION", advanceAtCount: 4, label: "Round 1" },
         { type: "IMAGE", advanceAtCount: 2, label: "Round 2" },
         { type: "VIDEO", advanceAtCount: 1, label: "Final Round" },
      ],
   },
};

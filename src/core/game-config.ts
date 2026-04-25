export const GameConfigRegistry: any = {
   INTERNET_BACHELOR: {
      minPlayers: 4,
      maxPlayers: 10,
      rounds: [
         { id: "ROUND_1", type: "QUESTION", eliminateCount: 4 },
         { id: "ROUND_2", type: "IMAGE", eliminateCount: 2 },
         { id: "ROUND_3", type: "VIDEO", eliminateCount: 1 },
      ],
   },
};

const rateMap = new Map<string, number>();

export const rateLimit = (socketId: string, event: string) => {
   const key = `${socketId}:${event}`;
   const now = Date.now();

   const last = rateMap.get(key) || 0;

   if (now - last < 300) {
      throw new Error("Too many requests");
   }

   rateMap.set(key, now);
};

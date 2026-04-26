import "dotenv/config";

type EnvConfig = {
   NODE_ENV: string;
   PORT: number;
   DATABASE_URL: string;
   REDIS_URL: string;
   ZEGO_APP_ID?: string;
   ZEGO_SERVER_SECRET?: string;
};

const requireEnv = (name: string): string => {
   const value = process.env[name];
   if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
   }
   return value;
};

const getPort = (): number => {
   const raw = process.env.PORT ?? "5000";
   const parsed = Number(raw);
   if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid PORT value: ${raw}`);
   }
   return parsed;
};

export const env: EnvConfig = {
   NODE_ENV: process.env.NODE_ENV ?? "development",
   PORT: getPort(),
   DATABASE_URL: requireEnv("DATABASE_URL"),
   REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
   ZEGO_APP_ID: process.env.ZEGO_APP_ID,
   ZEGO_SERVER_SECRET: process.env.ZEGO_SERVER_SECRET,
};

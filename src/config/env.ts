import dotenv from "dotenv";
import path from "path";
import { envRequireNumber, envRequireString } from "../utils/envValidate";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.join(process.cwd(), envFile) });

export default {
   // General
   NODE_ENV: envRequireString("NODE_ENV"),
   PORT: envRequireNumber("PORT"),
   DATABASE_URL: envRequireString("DATABASE_URL"),
   REDIS_URL: envRequireString("REDIS_URL"),

   FRONTEND_URL: envRequireString("FRONTEND_URL"),
   BCRYPT_SALT_ROUNDS: envRequireNumber("BCRYPT_SALT_ROUNDS"),

   // for call
   ZEGO_APP_ID: envRequireString("ZEGO_APP_ID"),
   ZEGO_APP_SECRET: envRequireString("ZEGO_APP_SECRET"),

   // Auth token
   jwt_token: {
      ACCESS_TOKEN_SECRET: envRequireString("ACCESS_TOKEN_SECRET"),
      ACCESS_EXPIRES_IN: envRequireString("ACCESS_EXPIRES_IN"),
   },

   // AWS Configuration
   aws: {
      AWS_ACCESS_KEY: envRequireString("AWS_ACCESS_KEY"),
      AWS_SECRET_KEY: envRequireString("AWS_SECRET_KEY"),
      AWS_REGION: envRequireString("AWS_REGION"),
      AWS_S3_BUCKET_NAME: envRequireString("AWS_S3_BUCKET_NAME"),
   },
};

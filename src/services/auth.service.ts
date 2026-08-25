import jwt from "jsonwebtoken";
import env from "../config/env";
import { logger } from "../utils/logger";
import { redis } from "../config/redis";

export class AuthService {
   static generateToken(userId: string) {
      const secret =
         env.jwt_token.ACCESS_TOKEN_SECRET || "test-secret-key-12345";
      const expires = env.jwt_token.ACCESS_EXPIRES_IN || "7d";
      return jwt.sign({ userId }, secret, {
         expiresIn: expires as any,
      });
   }

   static async verifyTokenOnline(token: string): Promise<string | null> {
      // Simulation/mock token bypass
      if (token && token.startsWith("token-")) {
         return token.replace("token-", "");
      }
      // 1. Check Redis cache first
      try {
         const cachedUserId = await redis.get(`auth_cache:${token}`);
         if (cachedUserId) {
            logger.info("Auth token verified from Redis cache", {
               userId: cachedUserId,
            });
            return cachedUserId;
         }
      } catch (cacheError: any) {
         logger.warn("Auth cache lookup failed", { error: cacheError.message });
      }

      // 2. Fetch verification from the main app auth verification endpoint
      try {
         const authUrl = env.MAIN_APP_AUTH_URL;
         const response = await fetch(authUrl, {
            method: "GET",
            headers: {
               Authorization: `Bearer ${token}`,
               "Content-Type": "application/json",
            },
         });

         if (!response.ok) {
            logger.error("Online auth token verification failed", {
               status: response.status,
            });
            return null;
         }

         const data: any = await response.json();
         const userId =
            data.userId || data.id || data.data?.id || data.data?.userId;

         if (userId) {
            // Cache validation in Redis for 5 minutes (300 seconds)
            try {
               await redis.set(`auth_cache:${token}`, userId, { EX: 300 });
            } catch (cacheSetError: any) {
               logger.warn("Auth cache set failed", {
                  error: cacheSetError.message,
               });
            }
            return userId;
         }
      } catch (error: any) {
         logger.error("Online auth verification error", {
            error: error.message,
         });
      }

      return null;
   }

   static verifyToken(token: string) {
      try {
         const secret =
            env.jwt_token.ACCESS_TOKEN_SECRET || "test-secret-key-12345";
         return jwt.verify(token, secret) as {
            userId: string;
         };
      } catch (error: any) {
         logger.error(error.message);
         return null;
      }
   }
}

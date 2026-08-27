import env from "../config/env";
import { redis } from "../config/redis";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

export class UserService {
   static async getUserProfile(userId: string, authHeader?: string) {
      const cleanId = String(userId || "").trim();
      if (!cleanId) {
         throw new AppError(400, "User ID is required");
      }

      const cacheKey = `user_profile:${cleanId}`;

      // 1. Try Redis Cache first
      try {
         const cachedProfile = await redis.get(cacheKey);
         if (cachedProfile) {
            logger.info("Serving user profile from Redis cache", { userId: cleanId });
            return JSON.parse(cachedProfile);
         }
      } catch (cacheErr: any) {
         logger.warn("Redis profile cache read failed", { error: cacheErr.message });
      }

      // 2. Query Main Backend API (https://api.internetbachelor.com/api/v1/users/:userId)
      const mainApiUrl = `${env.MAIN_WEBSITE_BACKEND_URL}/users/${encodeURIComponent(cleanId)}`;
      const headers: Record<string, string> = {
         "Content-Type": "application/json",
      };

      if (authHeader) {
         headers["Authorization"] = authHeader;
      }

      let response;
      try {
         response = await fetch(mainApiUrl, {
            method: "GET",
            headers,
         });
      } catch (err: any) {
         logger.error("Failed to query main backend profile API", { error: err.message });
         throw new AppError(500, "Error communicating with main backend service");
      }

      if (!response.ok) {
         logger.warn("Main backend profile fetch returned non-200", {
            userId: cleanId,
            status: response.status,
         });
         const errorBody = await response.json().catch(() => null);
         const errorMessage = errorBody?.message || "You are not authorized!";
         throw new AppError(response.status, errorMessage);
      }

      const responseData: any = await response.json();
      const profileResult = responseData.result || responseData.data || responseData;

      // 3. Cache profile in Redis for 5 minutes (300 seconds)
      try {
         await redis.set(cacheKey, JSON.stringify(profileResult), { EX: 300 });
      } catch (cacheSetErr: any) {
         logger.warn("Redis profile cache write failed", { error: cacheSetErr.message });
      }

      return profileResult;
   }
}

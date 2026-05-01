import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import env from "../config/env";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

export class AuthService {
   static async register(data: any) {
      const { email, password, name } = data;

      if (!email) {
         throw new AppError(400, "Email is required");
      }
      if (!password) {
         throw new AppError(400, "Password is required");
      }
      if (!name) {
         throw new AppError(400, "Name is required");
      }
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new AppError(400, "Email already registered");

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
         data: {
            email,
            password: hashedPassword,
            name,
         },
      });

      const token = this.generateToken(user.id);
      return { user, token };
   }

   static async login(data: any) {
      const { email, password } = data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new AppError(400, "Invalid credentials");

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new AppError(400, "Invalid credentials");

      const token = this.generateToken(user.id);
      return { user, token };
   }

   static generateToken(userId: string) {
      return jwt.sign({ userId }, env.jwt_token.ACCESS_TOKEN_SECRET, {
         expiresIn: env.jwt_token.ACCESS_EXPIRES_IN as any,
      });
   }

   static verifyToken(token: string) {
      try {
         return jwt.verify(token, env.jwt_token.ACCESS_TOKEN_SECRET) as {
            userId: string;
         };
      } catch (error: any) {
         logger.error(error.message);
         return null;
      }
   }
}

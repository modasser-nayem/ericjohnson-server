import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export class AuthService {
   static async register(data: any) {
      const { email, password, name } = data;

      if (!email) {
         throw new Error("Email is required");
      }
      if (!password) {
         throw new Error("Password is required");
      }
      if (!name) {
         throw new Error("Name is required");
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new Error("Email already registered");

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
      if (!user) throw new Error("Invalid credentials");

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new Error("Invalid credentials");

      const token = this.generateToken(user.id);
      return { user, token };
   }

   static generateToken(userId: string) {
      return jwt.sign({ userId }, JWT_SECRET, {
         expiresIn: JWT_EXPIRES_IN as any,
      });
   }

   static verifyToken(token: string) {
      try {
         return jwt.verify(token, JWT_SECRET) as { userId: string };
      } catch {
         return null;
      }
   }
}

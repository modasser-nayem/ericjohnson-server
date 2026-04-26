import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { env } from "../config/env";

void env.DATABASE_URL;

export const prisma = new PrismaClient();

export const disconnectPrisma = async () => {
   await prisma.$disconnect();
   logger.info("Prisma disconnected");
};

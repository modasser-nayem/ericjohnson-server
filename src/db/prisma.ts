import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

export const prisma = new PrismaClient();

export const disconnectPrisma = async () => {
   await prisma.$disconnect();
   logger.info("Prisma disconnected");
};

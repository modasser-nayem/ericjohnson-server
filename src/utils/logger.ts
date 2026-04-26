import fs from "fs";
import path from "path";
import winston from "winston";

const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
   fs.mkdirSync(logDir, { recursive: true });
}

export const logger = winston.createLogger({
   level: "info",
   format: winston.format.json(),
   transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: path.join(logDir, "app.log") }),
   ],
});

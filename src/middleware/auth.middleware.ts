import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";

export const authenticateJWT = (req: any, res: Response, next: NextFunction) => {
   const authHeader = req.headers.authorization;

   if (authHeader) {
      const token = authHeader.split(" ")[1];
      const decoded = AuthService.verifyToken(token);

      if (decoded) {
         req.user = decoded;
         return next();
      }
   }

   res.status(401).json({ error: "Unauthorized" });
};

import { ZodAny } from "zod";
import catchAsync from "../utils/catchAsync";

const validateRequest = (schema: ZodAny) => {
   return catchAsync(async (req, _res, next) => {
      const result = await schema.parseAsync(req.body);
      req.body = result;
      next();
   });
};

export default validateRequest;

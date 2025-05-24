import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth_header = req.headers.authorization;
  if (!auth_header || !auth_header.startsWith("Bearer")) {
    res.status(403).json({
      message: "no token given",
    });
    return;
  }

  try {
    const token = auth_header.split(" ")[1];
    console.log(token);
    const decode = jwt.verify(token, process.env.JWT_SECRET_KEY!) as JwtPayload;
    console.log(decode);
    // for get request that have no body
    (req as any).userId = decode.id;
    next();
  } catch (err) {
    res.status(403).json({
      message: "error verifying token" + err,
    });
    return;
  }
}

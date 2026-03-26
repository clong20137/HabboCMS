import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = String(req.headers["x-request-id"] || "").trim();
  const id = existing || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"));
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

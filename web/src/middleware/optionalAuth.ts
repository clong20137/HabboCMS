import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import {
  AUTH_COOKIE_NAME,
  JWT_SECRET,
  USE_HOST_COOKIE_PREFIX,
} from "../env";
import type { AuthPayload } from "../auth";

const COOKIE_NAME = USE_HOST_COOKIE_PREFIX
  ? `__Host-${AUTH_COOKIE_NAME}`
  : AUTH_COOKIE_NAME;

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.[COOKIE_NAME];
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = decoded;
    return next();
  } catch {
    // ignore invalid cookies
    return next();
  }
}

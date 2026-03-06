import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  AUTH_COOKIE_NAME,
  IS_PROD,
  JWT_SECRET,
  USE_HOST_COOKIE_PREFIX,
} from "./env";
import { getBanStatus } from "./services/ban.service";

export type AuthPayload = {
  id: number;
  username: string;
  rank: number;
};

const COOKIE_NAME = USE_HOST_COOKIE_PREFIX
  ? `__Host-${AUTH_COOKIE_NAME}`
  : AUTH_COOKIE_NAME;

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Require an authenticated session cookie.
 * Also enforces bans on every authed request (fail-open if ban system errors).
 *
 * IMPORTANT: do not mark this function `async` (Express 4 does not await promises).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = (req as any).cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = decoded;

    // Enforce bans (kicks banned sessions ASAP)
    getBanStatus({
      userId: Number(decoded.id),
      username: String(decoded.username),
      ip: req.ip,
    })
      .then((ban) => {
        if (ban?.banned) {
          clearAuthCookie(res);
          return res.status(403).json({
            ok: false,
            error: "BANNED",
            message: `You are banned: ${ban.reason || "You are banned."}`,
            reason: ban.reason || "You are banned.",
            expiresAt: ban.expiresAt ?? null,
          });
        }

        return next();
      })
      .catch(() => {
        // fail open to avoid taking the site down if bans table/db is unavailable
        return next();
      });

    return;
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid session" });
  }
}

export function requireStaff(minRank = 4) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }
    if ((user.rank ?? 0) < minRank) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }
    return next();
  };
}

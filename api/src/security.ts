import type { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";
import crypto from "crypto";

import { CORS_ORIGINS, IS_PROD, TRUST_PROXY } from "./env";
import { requestIdMiddleware } from "./middleware/requestId";
import { httpLogger } from "./middleware/logger";

const CSRF_COOKIE = "pluscsrf";

/**
 * Double-submit CSRF:
 * - server sets a non-httpOnly cookie "pluscsrf"
 * - client sends header "X-CSRF-Token" matching that cookie on mutations
 */
export function csrfIssueToken(_req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });

  return res.json({ ok: true, csrfToken: token });
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (!isMutation) return next();
  if (req.path.startsWith("/api/install")) return next();

  const csrfCookie = String((req as any).cookies?.[CSRF_COOKIE] || "");
  const csrfHeader = String(req.headers["x-csrf-token"] || "");

  if (!csrfCookie || !csrfHeader) {
    return res.status(403).json({ ok: false, error: "CSRF blocked" });
  }

  // constant-time compare
  const a = Buffer.from(csrfCookie);
  const b = Buffer.from(csrfHeader);
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!same) {
    return res.status(403).json({ ok: false, error: "CSRF blocked" });
  }
  return next();
}

function parseOriginAllowlist() {
  const allow = new Set(CORS_ORIGINS);
  // In development it's common to hit the API from different localhost ports,
  // LAN IPs, or tunnel URLs. If no allowlist is configured, allow all origins.
  const allowAllInDev = !IS_PROD && allow.size === 0;
  return (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    if (!origin) return cb(null, true);
    if (allowAllInDev) return cb(null, true);
    if (allow.has(origin)) return cb(null, true);

    // Attach a 403 so our global error handler doesn't mask this as a 500.
    const err: any = new Error("Not allowed by CORS");
    err.status = 403;
    err.code = "CORS_BLOCKED";
    err.details = { origin, allowed: Array.from(allow) };
    return cb(err);
  };
}

function disableApiCaching() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  };
}

function jsonLimits() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require("express");
  return express.json({ limit: "256kb" });
}

function requireJsonOnly() {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (!isMutation) return next();
    if (req.path.startsWith("/api/install")) return next();

    // Allow empty-body mutations (e.g., POST /auth/sso, POST /auth/logout)
    const hasBody =
      req.headers["content-length"] !== undefined
        ? Number(req.headers["content-length"]) > 0
        : Boolean(req.headers["transfer-encoding"]);

    if (!hasBody) return next();

    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return res.status(415).json({ ok: false, error: "Content-Type must be application/json" });
    }
    return next();
  };
}

export function applySecurity(app: Express) {
  app.disable("x-powered-by");
  app.disable("etag");
  // IMPORTANT: configure this for your deployment topology.
  // If misconfigured, attackers may spoof IP-related headers.
  app.set("trust proxy", TRUST_PROXY);

  // Request IDs + structured logs
  app.use(requestIdMiddleware);
  // pino-http types are not Express-first; cast to satisfy Express' overloads.
  app.use(httpLogger as any);

  app.use(
    helmet({
      // if you serve images/assets on a different domain you may want cross-origin
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }) as any,
  );

  app.use(hpp() as any);
  app.use("/api", disableApiCaching());
  app.use(requireJsonOnly());
  app.use(cookieParser() as any);
  app.use(jsonLimits());

  app.use(
    cors({
      origin: parseOriginAllowlist(),
      credentials: true,
    }) as any,
  );

  app.use(requireCsrf);
}

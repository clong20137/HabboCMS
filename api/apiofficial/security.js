"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfIssueToken = csrfIssueToken;
exports.applySecurity = applySecurity;
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("./env");
const requestId_1 = require("./middleware/requestId");
const logger_1 = require("./middleware/logger");
const CSRF_COOKIE = "pluscsrf";
/**
 * Double-submit CSRF:
 * - server sets a non-httpOnly cookie "pluscsrf"
 * - client sends header "X-CSRF-Token" matching that cookie on mutations
 */
function csrfIssueToken(_req, res) {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        sameSite: "lax",
        secure: env_1.IS_PROD,
        path: "/",
        maxAge: 12 * 60 * 60 * 1000,
    });
    return res.json({ ok: true, csrfToken: token });
}
function requireCsrf(req, res, next) {
    const method = req.method.toUpperCase();
    const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (!isMutation)
        return next();
    if (req.path.startsWith("/api/install"))
        return next();
    const csrfCookie = String(req.cookies?.[CSRF_COOKIE] || "");
    const csrfHeader = String(req.headers["x-csrf-token"] || "");
    if (!csrfCookie || !csrfHeader) {
        return res.status(403).json({ ok: false, error: "CSRF blocked" });
    }
    // constant-time compare
    const a = Buffer.from(csrfCookie);
    const b = Buffer.from(csrfHeader);
    const same = a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
    if (!same) {
        return res.status(403).json({ ok: false, error: "CSRF blocked" });
    }
    return next();
}
function parseOriginAllowlist() {
    const allow = new Set(env_1.CORS_ORIGINS);
    // In development it's common to hit the API from different localhost ports,
    // LAN IPs, or tunnel URLs. If no allowlist is configured, allow all origins.
    const allowAllInDev = !env_1.IS_PROD && allow.size === 0;
    return (origin, cb) => {
        if (!origin)
            return cb(null, true);
        if (allowAllInDev)
            return cb(null, true);
        if (allow.has(origin))
            return cb(null, true);
        // Attach a 403 so our global error handler doesn't mask this as a 500.
        const err = new Error("Not allowed by CORS");
        err.status = 403;
        err.code = "CORS_BLOCKED";
        err.details = { origin, allowed: Array.from(allow) };
        return cb(err);
    };
}
function disableApiCaching() {
    return (_req, res, next) => {
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
    return (req, res, next) => {
        const method = req.method.toUpperCase();
        const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
        if (!isMutation)
            return next();
        if (req.path.startsWith("/api/install"))
            return next();
        // Allow empty-body mutations (e.g., POST /auth/sso, POST /auth/logout)
        const hasBody = req.headers["content-length"] !== undefined
            ? Number(req.headers["content-length"]) > 0
            : Boolean(req.headers["transfer-encoding"]);
        if (!hasBody)
            return next();
        const ct = String(req.headers["content-type"] || "").toLowerCase();
        if (!ct.includes("application/json")) {
            return res.status(415).json({ ok: false, error: "Content-Type must be application/json" });
        }
        return next();
    };
}
function applySecurity(app) {
    app.disable("x-powered-by");
    app.disable("etag");
    // IMPORTANT: configure this for your deployment topology.
    // If misconfigured, attackers may spoof IP-related headers.
    app.set("trust proxy", env_1.TRUST_PROXY);
    // Request IDs + structured logs
    app.use(requestId_1.requestIdMiddleware);
    // pino-http types are not Express-first; cast to satisfy Express' overloads.
    app.use(logger_1.httpLogger);
    app.use((0, helmet_1.default)({
        // if you serve images/assets on a different domain you may want cross-origin
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }));
    app.use((0, hpp_1.default)());
    app.use("/api", disableApiCaching());
    app.use(requireJsonOnly());
    app.use((0, cookie_parser_1.default)());
    app.use(jsonLimits());
    app.use((0, cors_1.default)({
        origin: parseOriginAllowlist(),
        credentials: true,
    }));
    app.use(requireCsrf);
}

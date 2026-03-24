"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.requireAuth = requireAuth;
exports.requireStaff = requireStaff;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
const ban_service_1 = require("./services/ban.service");
const COOKIE_NAME = env_1.USE_HOST_COOKIE_PREFIX
    ? `__Host-${env_1.AUTH_COOKIE_NAME}`
    : env_1.AUTH_COOKIE_NAME;
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_1.JWT_SECRET, { expiresIn: "7d" });
}
function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: env_1.IS_PROD,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
}
/**
 * Require an authenticated session cookie.
 * Also enforces bans on every authed request (fail-open if ban system errors).
 *
 * IMPORTANT: do not mark this function `async` (Express 4 does not await promises).
 */
function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) {
            return res.status(401).json({ ok: false, error: "Not authenticated" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
        req.user = decoded;
        // Enforce bans (kicks banned sessions ASAP)
        (0, ban_service_1.getBanStatus)({
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
    }
    catch {
        return res.status(401).json({ ok: false, error: "Invalid session" });
    }
}
function requireStaff(minRank = 4) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, error: "Not authenticated" });
        }
        if ((user.rank ?? 0) < minRank) {
            return res.status(403).json({ ok: false, error: "Access denied" });
        }
        return next();
    };
}

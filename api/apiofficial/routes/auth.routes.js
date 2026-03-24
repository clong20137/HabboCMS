"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const ban_service_1 = require("../services/ban.service");
const db_1 = require("../db");
const auth_1 = require("../auth");
const limiters_1 = require("../middleware/limiters");
const asyncHandler_1 = require("../middleware/asyncHandler");
const validate_1 = require("../middleware/validate");
const response_1 = require("../utils/response");
const auth_schema_1 = require("../validation/auth.schema");
const authService = __importStar(require("../services/auth.service"));
const ApiError_1 = require("../errors/ApiError");
// ✅ 2FA login challenge helpers
const loginChallenges_1 = require("../auth/loginChallenges");
const twofa_schema_1 = require("../validation/twofa.schema");
const twofa_service_1 = require("../services/twofa.service"); // verifyTotp(secretEnc, code)
// ✅ NEW: login history
const loginHistory = __importStar(require("../services/loginHistory.service"));
exports.authRouter = express_1.default.Router();
exports.authRouter.get("/register-config", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const cfg = await authService.getRegisterConfig(db_1.pool);
    return (0, response_1.ok)(res, cfg);
}));
exports.authRouter.get("/check-username", limiters_1.authLimiter, (0, validate_1.validateQuery)(auth_schema_1.qCheckUsername), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = String(req.query.username || "");
    const out = await authService.checkUsernameAvailability(db_1.pool, username);
    return (0, response_1.ok)(res, out);
}));
exports.authRouter.post("/register", limiters_1.authLimiter, (0, validate_1.validateBody)(auth_schema_1.bRegister), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const result = await authService.register(db_1.pool, { ...body, ip: req.ip });
    // ✅ NEW: force first-time stat setup (5 points) using "points"
    await authService.markNewUserNeedsStatsSetup(db_1.pool, result.userId);
    const token = (0, auth_1.signToken)({
        id: result.userId,
        username: result.username,
        rank: 1,
    });
    (0, auth_1.setAuthCookie)(res, token);
    return (0, response_1.ok)(res, {
        user: { id: result.userId, username: result.username, rank: 1 },
    });
}));
/**
 * ✅ UPDATED LOGIN:
 * - Valid password + no 2FA => set cookie and return user
 * - Valid password + 2FA enabled => return challengeId, DO NOT set cookie yet
 */
exports.authRouter.post("/login", limiters_1.loginLimiter, (0, validate_1.validateBody)(auth_schema_1.bLogin), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await authService.login(db_1.pool, req.body);
    // ✅ Ban check BEFORE any 2FA challenge or cookie
    const ban = await (0, ban_service_1.getBanStatus)({
        userId: Number(user.id),
        username: String(user.username),
        ip: req.ip,
    });
    if (ban.banned) {
        (0, auth_1.clearAuthCookie)(res);
        return res.status(403).json({
            ok: false,
            error: "BANNED",
            message: `You are banned: ${ban.reason || "You are banned."}`,
            reason: ban.reason || "You are banned.",
            expiresAt: ban.expiresAt ?? null,
        });
    }
    // check if 2FA enabled
    const [rows] = (await db_1.pool.query("SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = ? LIMIT 1", [user.id]));
    const twoFaEnabled = !!rows?.[0]?.two_factor_enabled;
    const secretEnc = String(rows?.[0]?.two_factor_secret || "");
    if (twoFaEnabled && secretEnc) {
        const { challengeId } = (0, loginChallenges_1.createLoginChallenge)({
            userId: Number(user.id),
            username: String(user.username),
            rank: Number(user.rank),
            secretEnc,
        });
        return (0, response_1.ok)(res, { twoFaRequired: true, challengeId });
    }
    await loginHistory.recordLogin({
        pool: db_1.pool,
        req,
        userId: Number(user.id),
        authMethod: "password",
        success: true,
    });
    const token = (0, auth_1.signToken)({
        id: user.id,
        username: user.username,
        rank: user.rank,
    });
    (0, auth_1.setAuthCookie)(res, token);
    return (0, response_1.ok)(res, {
        user: { id: user.id, username: user.username, rank: user.rank },
    });
}));
/**
 * ✅ Verify 2FA during login
 * POST /auth/2fa/verify-login { challengeId, code }
 */
exports.authRouter.post("/2fa/verify-login", limiters_1.loginLimiter, (0, validate_1.validateBody)(twofa_schema_1.bVerifyLogin2FA), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { challengeId, code } = req.body;
    const peek = (0, loginChallenges_1.peekLoginChallenge)(String(challengeId));
    if (!peek) {
        return res
            .status(400)
            .json({ ok: false, error: "2FA session expired. Please login again." });
    }
    const ch = (0, loginChallenges_1.consumeLoginChallenge)(String(challengeId));
    if (!ch) {
        return res
            .status(400)
            .json({ ok: false, error: "2FA session expired. Please login again." });
    }
    // ✅ Ban check BEFORE issuing cookie
    const ban = await (0, ban_service_1.getBanStatus)({
        userId: Number(ch.userId),
        username: String(ch.username),
        ip: req.ip,
    });
    if (ban.banned) {
        (0, auth_1.clearAuthCookie)(res);
        return res.status(403).json({
            ok: false,
            error: "BANNED",
            reason: ban.reason,
            expiresAt: ban.expiresAt ?? null,
        });
    }
    const okCode = (0, twofa_service_1.verifyTotp)(ch.secretEnc, String(code));
    if (!okCode) {
        return res.status(400).json({ ok: false, error: "Invalid 2FA code." });
    }
    await loginHistory.recordLogin({
        pool: db_1.pool,
        req,
        userId: Number(ch.userId),
        authMethod: "2fa",
        success: true,
    });
    const token = (0, auth_1.signToken)({
        id: ch.userId,
        username: ch.username,
        rank: ch.rank,
    });
    (0, auth_1.setAuthCookie)(res, token);
    return (0, response_1.ok)(res, {
        user: { id: ch.userId, username: ch.username, rank: ch.rank },
    });
}));
exports.authRouter.post("/logout", (_req, res) => {
    (0, auth_1.clearAuthCookie)(res);
    (0, response_1.ok)(res);
});
/* =========================
STATS SETUP (ONE-TIME)
========================= */
exports.authRouter.get("/stats-setup/status", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const u = req.user;
    const out = await authService.getStatsSetupStatus(db_1.pool, u.id);
    return (0, response_1.ok)(res, out);
}));
exports.authRouter.post("/stats-setup/apply", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const u = req.user;
    const body = req.body;
    const inc = {
        strength: Number(body?.strength ?? 0),
        knowledge: Number(body?.knowledge ?? 0),
        farming: Number(body?.farming ?? 0),
        health: Number(body?.health ?? 0),
        defense: Number(body?.defense ?? 0),
        stamina: Number(body?.stamina ?? 0),
    };
    if (Object.values(inc).some((v) => !Number.isFinite(v) || v < 0)) {
        throw (0, ApiError_1.badRequest)("Invalid point values.");
    }
    const total = inc.strength +
        inc.knowledge +
        inc.farming +
        inc.health +
        inc.defense +
        inc.stamina;
    if (!Number.isFinite(total) || total <= 0) {
        throw (0, ApiError_1.badRequest)("No points applied.");
    }
    const out = await authService.applyStatsSetup(db_1.pool, u.id, inc);
    return (0, response_1.ok)(res, out);
}));
exports.authRouter.get("/me", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const u = req.user;
    const user = await authService.getMe(db_1.pool, u.id);
    if (!user)
        throw (0, ApiError_1.notFound)("User not found.");
    return (0, response_1.ok)(res, {
        user: {
            id: Number(user.id),
            username: String(user.username),
            mail: user.mail,
            rank: Number(user.rank ?? 0),
            credits: Number(user.credits ?? 0),
            bank_amount: Number(user.bank_credits ?? 0),
            kd: Number(user.deaths ?? 0) > 0 ? Number(user.kills ?? 0) / Number(user.deaths ?? 1) : Number(user.kills ?? 0),
            kills: Number(user.kills ?? 0),
            deaths: Number(user.deaths ?? 0),
            punches_thrown: Number(user.punches_thrown ?? 0),
            punches_received: Number(user.punches_landed ?? 0),
            arrests_made: Number(user.arrests ?? 0),
            arrests_amount: Number(user.arrests ?? 0),
            damage_dealt: Number(user.damage_inflicted ?? 0),
            damage_received: Number(user.damage_received ?? 0),
            // Stats
            strength: Number(user.strength ?? 0),
            knowledge: Number(user.knowledge ?? 0),
            farming: Number(user.gathering ?? 0),
            health: 0,
            defense: Number(user.defense ?? 0),
            stamina: Number(user.stamina ?? 0),
            // Health/Energy
            maxHealth: Number(user.max_health ?? 0),
            maxEnergy: Number(user.max_energy ?? 0),
            energy: Number(user.energy ?? 0),
            // Setup gating
            points: Number(user.stat_points ?? 0),
            statsSetupDone: Number(user.stats_setup_done ?? 1) === 1,
            corporation: user.corporation ?? null,
        },
    });
}));
// ✅ NEW: login history endpoint
exports.authRouter.get("/login-history", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const u = req.user;
    const limit = Number(req.query?.limit ?? 20);
    const rows = await loginHistory.getLoginHistory(db_1.pool, u.id, limit);
    return (0, response_1.ok)(res, { rows });
}));
exports.authRouter.post("/sso", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const u = req.user;
    const ticket = `SSO-${u.id}-${crypto_1.default.randomBytes(24).toString("hex")}`;
    await authService.createSsoTicket(db_1.pool, { userId: u.id, ticket });
    return (0, response_1.ok)(res, { ticket });
}));

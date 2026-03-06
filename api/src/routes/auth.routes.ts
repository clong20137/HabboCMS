import crypto from "crypto";
import express from "express";
import { getBanStatus } from "../services/ban.service";

import { pool } from "../db";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from "../auth";
import { authLimiter, loginLimiter } from "../middleware/limiters";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateBody, validateQuery } from "../middleware/validate";
import { ok } from "../utils/response";
import { qCheckUsername, bRegister, bLogin } from "../validation/auth.schema";
import * as authService from "../services/auth.service";
import { notFound, badRequest } from "../errors/ApiError";

// ✅ 2FA login challenge helpers
import {
  createLoginChallenge,
  consumeLoginChallenge,
  peekLoginChallenge,
} from "../auth/loginChallenges";
import { bVerifyLogin2FA } from "../validation/twofa.schema";
import { verifyTotp } from "../services/twofa.service"; // verifyTotp(secretEnc, code)

// ✅ NEW: login history
import * as loginHistory from "../services/loginHistory.service";

export const authRouter = express.Router();

authRouter.get(
  "/register-config",
  asyncHandler(async (_req, res) => {
    const cfg = await authService.getRegisterConfig(pool);
    return ok(res, cfg as any);
  }),
);

authRouter.get(
  "/check-username",
  authLimiter,
  validateQuery(qCheckUsername),
  asyncHandler(async (req, res) => {
    const username = String((req.query as any).username || "");
    const out = await authService.checkUsernameAvailability(pool, username);
    return ok(res, out as any);
  }),
);

authRouter.post(
  "/register",
  authLimiter,
  validateBody(bRegister),
  asyncHandler(async (req, res) => {
    const body = req.body as any;
    const result = await authService.register(pool, body);

    // ✅ NEW: force first-time stat setup (5 points) using "points"
    await authService.markNewUserNeedsStatsSetup(pool, result.userId);

    const token = signToken({
      id: result.userId,
      username: result.username,
      rank: 1,
    });

    setAuthCookie(res, token);
    return ok(res, {
      user: { id: result.userId, username: result.username, rank: 1 },
    });
  }),
);

/**
 * ✅ UPDATED LOGIN:
 * - Valid password + no 2FA => set cookie and return user
 * - Valid password + 2FA enabled => return challengeId, DO NOT set cookie yet
 */
authRouter.post(
  "/login",
  loginLimiter,
  validateBody(bLogin),
  asyncHandler(async (req, res) => {
    const user = await authService.login(pool, req.body as any);

    // ✅ Ban check BEFORE any 2FA challenge or cookie
    const ban = await getBanStatus({
      userId: Number(user.id),
      username: String(user.username),
      ip: req.ip,
    });

    if (ban.banned) {
      clearAuthCookie(res);
      return res.status(403).json({
        ok: false,
        error: "BANNED",
        message: `You are banned: ${ban.reason || "You are banned."}`,
        reason: ban.reason || "You are banned.",
        expiresAt: ban.expiresAt ?? null,
      });
    }

    // check if 2FA enabled
    const [rows] = (await (pool as any).query(
      "SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = ? LIMIT 1",
      [user.id],
    )) as any;

    const twoFaEnabled = !!rows?.[0]?.two_factor_enabled;
    const secretEnc = String(rows?.[0]?.two_factor_secret || "");

    if (twoFaEnabled && secretEnc) {
      const { challengeId } = createLoginChallenge({
        userId: Number(user.id),
        username: String(user.username),
        rank: Number(user.rank),
        secretEnc,
      });

      return ok(res, { twoFaRequired: true, challengeId });
    }

    await loginHistory.recordLogin({
      pool: pool as any,
      req,
      userId: Number(user.id),
      authMethod: "password",
      success: true,
    });

    const token = signToken({
      id: user.id,
      username: user.username,
      rank: user.rank,
    });

    setAuthCookie(res, token);

    return ok(res, {
      user: { id: user.id, username: user.username, rank: user.rank },
    });
  }),
);

/**
 * ✅ Verify 2FA during login
 * POST /auth/2fa/verify-login { challengeId, code }
 */
authRouter.post(
  "/2fa/verify-login",
  loginLimiter,
  validateBody(bVerifyLogin2FA),
  asyncHandler(async (req, res) => {
    const { challengeId, code } = req.body as any;

    const peek = peekLoginChallenge(String(challengeId));
    if (!peek) {
      return res
        .status(400)
        .json({ ok: false, error: "2FA session expired. Please login again." });
    }

    const ch = consumeLoginChallenge(String(challengeId));
    if (!ch) {
      return res
        .status(400)
        .json({ ok: false, error: "2FA session expired. Please login again." });
    }

    // ✅ Ban check BEFORE issuing cookie
    const ban = await getBanStatus({
      userId: Number(ch.userId),
      username: String(ch.username),
      ip: req.ip,
    });

    if (ban.banned) {
      clearAuthCookie(res);
      return res.status(403).json({
        ok: false,
        error: "BANNED",
        reason: ban.reason,
        expiresAt: ban.expiresAt ?? null,
      });
    }

    const okCode = verifyTotp(ch.secretEnc, String(code));
    if (!okCode) {
      return res.status(400).json({ ok: false, error: "Invalid 2FA code." });
    }

    await loginHistory.recordLogin({
      pool: pool as any,
      req,
      userId: Number(ch.userId),
      authMethod: "2fa",
      success: true,
    });

    const token = signToken({
      id: ch.userId,
      username: ch.username,
      rank: ch.rank,
    });

    setAuthCookie(res, token);

    return ok(res, {
      user: { id: ch.userId, username: ch.username, rank: ch.rank },
    });
  }),
);


authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  ok(res);
});

/* =========================
STATS SETUP (ONE-TIME)
========================= */

authRouter.get(
  "/stats-setup/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = (req as any).user as { id: number };
    const out = await authService.getStatsSetupStatus(pool, u.id);
    return ok(res, out as any);
  }),
);

authRouter.post(
  "/stats-setup/apply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = (req as any).user as { id: number };

    const body = req.body as any;

    const inc = {
      strength: Number(body?.strength ?? 0),
      knowledge: Number(body?.knowledge ?? 0),
      farming: Number(body?.farming ?? 0),
      health: Number(body?.health ?? 0),
      defense: Number(body?.defense ?? 0),
      stamina: Number(body?.stamina ?? 0),
    };

    if (Object.values(inc).some((v) => !Number.isFinite(v) || v < 0)) {
      throw badRequest("Invalid point values.");
    }

    const total =
      inc.strength +
      inc.knowledge +
      inc.farming +
      inc.health +
      inc.defense +
      inc.stamina;

    if (!Number.isFinite(total) || total <= 0) {
      throw badRequest("No points applied.");
    }

    const out = await authService.applyStatsSetup(pool, u.id, inc);
    return ok(res, out as any);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = (req as any).user as { id: number };
    const user = await authService.getMe(pool, u.id);
    if (!user) throw notFound("User not found.");

    return ok(res, {
      user: {
        id: Number(user.id),
        username: String(user.username),
        mail: (user as any).mail,
        rank: Number((user as any).rank ?? 0),

        credits: Number((user as any).credits ?? 0),
        bank_amount: Number((user as any).bank_amount ?? 0),
        kd: Number((user as any).kd ?? 0),

        kills: Number((user as any).kills ?? 0),
        deaths: Number((user as any).deaths ?? 0),
        punches_thrown: Number((user as any).punches_thrown ?? 0),
        punches_received: Number((user as any).punches_received ?? 0),
        arrests_made: Number((user as any).arrests_made ?? 0),
        arrests_amount: Number((user as any).arrests_amount ?? 0),
        damage_dealt: Number((user as any).damage_dealt ?? 0),
        damage_received: Number((user as any).damage_received ?? 0),

        // Stats
        strength: Number((user as any).strength ?? 0),
        knowledge: Number((user as any).knowledge ?? 0),
        farming: Number((user as any).farming ?? 0),
        health: Number((user as any).health ?? 0),
        defense: Number((user as any).defense ?? 0),
        stamina: Number((user as any).stamina ?? 0),

        // Health/Energy
        maxHealth: Number((user as any).max_health ?? 0),
        maxEnergy: Number((user as any).max_energy ?? 0),
        energy: Number((user as any).energy ?? 0),

        // Setup gating
        points: Number((user as any).points ?? 0),
        statsSetupDone: Number((user as any).stats_setup_done ?? 1) === 1,
      },
    });
  }),
);

// ✅ NEW: login history endpoint
authRouter.get(
  "/login-history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = (req as any).user as { id: number };
    const limit = Number((req.query as any)?.limit ?? 20);
    const rows = await loginHistory.getLoginHistory(pool as any, u.id, limit);
    return ok(res, { rows });
  }),
);

authRouter.post(
  "/sso",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = (req as any).user as { id: number };
    const ticket = `SSO-${u.id}-${crypto.randomBytes(24).toString("hex")}`;
    await authService.createSsoTicket(pool, { userId: u.id, ticket });
    return ok(res, { ticket });
  }),
);

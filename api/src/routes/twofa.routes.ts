import express from "express";
import { pool } from "../db";
import { requireAuth } from "../auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { ok } from "../utils/response";
import {
  generateSetup,
  verifyTotp,
  verifyBackupCode,
} from "../services/twofa.service";

export const twofaRouter = express.Router();

/**
 * GET /api/2fa/status
 */
twofaRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const userId = req.user.id;

    const [rows]: any = await pool.query(
      "SELECT two_factor_enabled AS enabled FROM users WHERE id = ? LIMIT 1",
      [userId],
    );

    return ok(res, { enabled: !!rows?.[0]?.enabled });
  }),
);

/**
 * POST /api/2fa/setup
 * Creates a pending secret stored server-side temporarily in DB.
 * (Simpler approach: store secretEnc in DB in a "pending" column; but we’ll store in same column while disabled)
 */
twofaRouter.post(
  "/setup",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const userId = req.user.id;
    const username = req.user.username;

    // if already enabled, block
    const [rows]: any = await pool.query(
      "SELECT two_factor_enabled AS enabled FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (rows?.[0]?.enabled)
      return res.status(400).json({ ok: false, error: "2FA already enabled" });

    const setup = await generateSetup(username);

    // Store secret encrypted (but still not enabled)
    await pool.query(
      "UPDATE users SET two_factor_secret = ?, two_factor_backup_codes = ? WHERE id = ?",
      [setup.secretEnc, JSON.stringify(setup.backupCodesHashed), userId],
    );

    // Send QR + backup codes ONCE
    return ok(res, {
      qrDataUrl: setup.qrDataUrl,
      backupCodes: setup.backupCodesPlain,
    });
  }),
);

/**
 * POST /api/2fa/enable
 * body: { code: string }
 */
twofaRouter.post(
  "/enable",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const userId = req.user.id;
    const code = String(req.body?.code || "");

    const [rows]: any = await pool.query(
      "SELECT two_factor_enabled AS enabled, two_factor_secret AS secretEnc FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const row = rows?.[0];
    if (!row?.secretEnc)
      return res.status(400).json({ ok: false, error: "No pending setup" });
    if (row?.enabled)
      return res.status(400).json({ ok: false, error: "2FA already enabled" });

    if (!verifyTotp(row.secretEnc, code)) {
      return res.status(400).json({ ok: false, error: "Invalid code" });
    }

    await pool.query("UPDATE users SET two_factor_enabled = 1 WHERE id = ?", [
      userId,
    ]);

    return ok(res, { enabled: true });
  }),
);

/**
 * POST /api/2fa/disable
 * body: { password: string, code?: string } (you can require password re-check later)
 */
twofaRouter.post(
  "/disable",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const userId = req.user.id;

    await pool.query(
      "UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = ?",
      [userId],
    );

    return ok(res, { enabled: false });
  }),
);

/**
 * POST /api/2fa/verify
 * Used during login flow if password ok but needs 2fa.
 * body: { userId: number, code: string }
 *
 * NOTE: This endpoint should only work with a short-lived login token in a real system.
 * For now, you can implement the simpler “pending login” flow later.
 */
twofaRouter.post(
  "/verify",
  asyncHandler(async (req: any, res) => {
    // placeholder for later login integration
    return res
      .status(501)
      .json({ ok: false, error: "Not wired yet (login flow step)" });
  }),
);
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twofaRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const auth_1 = require("../auth");
const asyncHandler_1 = require("../middleware/asyncHandler");
const response_1 = require("../utils/response");
const twofa_service_1 = require("../services/twofa.service");
exports.twofaRouter = express_1.default.Router();
/**
 * GET /api/2fa/status
 */
exports.twofaRouter.get("/status", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const [rows] = await db_1.pool.query("SELECT two_factor_enabled AS enabled FROM users WHERE id = ? LIMIT 1", [userId]);
    return (0, response_1.ok)(res, { enabled: !!rows?.[0]?.enabled });
}));
/**
 * POST /api/2fa/setup
 * Creates a pending secret stored server-side temporarily in DB.
 * (Simpler approach: store secretEnc in DB in a "pending" column; but we’ll store in same column while disabled)
 */
exports.twofaRouter.post("/setup", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username;
    // if already enabled, block
    const [rows] = await db_1.pool.query("SELECT two_factor_enabled AS enabled FROM users WHERE id = ? LIMIT 1", [userId]);
    if (rows?.[0]?.enabled)
        return res.status(400).json({ ok: false, error: "2FA already enabled" });
    const setup = await (0, twofa_service_1.generateSetup)(username);
    // Store secret encrypted (but still not enabled)
    await db_1.pool.query("UPDATE users SET two_factor_secret = ?, two_factor_backup_codes = ? WHERE id = ?", [setup.secretEnc, JSON.stringify(setup.backupCodesHashed), userId]);
    // Send QR + backup codes ONCE
    return (0, response_1.ok)(res, {
        qrDataUrl: setup.qrDataUrl,
        backupCodes: setup.backupCodesPlain,
    });
}));
/**
 * POST /api/2fa/enable
 * body: { code: string }
 */
exports.twofaRouter.post("/enable", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const code = String(req.body?.code || "");
    const [rows] = await db_1.pool.query("SELECT two_factor_enabled AS enabled, two_factor_secret AS secretEnc FROM users WHERE id = ? LIMIT 1", [userId]);
    const row = rows?.[0];
    if (!row?.secretEnc)
        return res.status(400).json({ ok: false, error: "No pending setup" });
    if (row?.enabled)
        return res.status(400).json({ ok: false, error: "2FA already enabled" });
    if (!(0, twofa_service_1.verifyTotp)(row.secretEnc, code)) {
        return res.status(400).json({ ok: false, error: "Invalid code" });
    }
    await db_1.pool.query("UPDATE users SET two_factor_enabled = 1 WHERE id = ?", [
        userId,
    ]);
    return (0, response_1.ok)(res, { enabled: true });
}));
/**
 * POST /api/2fa/disable
 * body: { password: string, code?: string } (you can require password re-check later)
 */
exports.twofaRouter.post("/disable", auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    await db_1.pool.query("UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = ?", [userId]);
    return (0, response_1.ok)(res, { enabled: false });
}));
/**
 * POST /api/2fa/verify
 * Used during login flow if password ok but needs 2fa.
 * body: { userId: number, code: string }
 *
 * NOTE: This endpoint should only work with a short-lived login token in a real system.
 * For now, you can implement the simpler “pending login” flow later.
 */
exports.twofaRouter.post("/verify", (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // placeholder for later login integration
    return res
        .status(501)
        .json({ ok: false, error: "Not wired yet (login flow step)" });
}));

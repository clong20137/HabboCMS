"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hkBansRouter = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const db_1 = require("../../db");
const asyncHandler_1 = require("../../middleware/asyncHandler");
const auth_1 = require("../../auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../utils/response");
const ApiError_1 = require("../../errors/ApiError");
exports.hkBansRouter = express_1.default.Router();
exports.hkBansRouter.use(auth_1.requireAuth);
exports.hkBansRouter.use((0, auth_1.requireStaff)(4));
const qList = zod_1.z.object({
    q: zod_1.z.string().trim().max(64).optional(),
    bantype: zod_1.z.enum(["account", "ip", "machine", "super"]).optional(),
    limit: (0, validate_1.zInt)({ min: 1, max: 200 }).optional().default(50),
});
exports.hkBansRouter.get("/", (0, validate_1.validateQuery)(qList), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { q, bantype, limit } = req.query;
    const where = [];
    const params = [];
    if (bantype) {
        where.push("type = ?");
        params.push(bantype);
    }
    if (q) {
        where.push("(CAST(user_id AS CHAR) LIKE ? OR ip LIKE ? OR machine_id LIKE ? OR ban_reason LIKE ?)");
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await db_1.pool.query(`
      SELECT id, user_id, ip, machine_id, user_staff_id, timestamp, ban_expire, ban_reason, type, cfh_topic
      FROM bans
      ${whereSql}
      ORDER BY id DESC
      LIMIT ?
      `, [...params, Number(limit)]);
    return (0, response_1.ok)(res, { items: rows || [] });
}));
const bCreate = zod_1.z.object({
    bantype: zod_1.z.enum(["account", "ip", "machine", "super"]),
    user_id: zod_1.z.number().int().positive().optional(),
    ip: zod_1.z.string().trim().max(45).optional(),
    machine_id: zod_1.z.string().trim().max(255).optional(),
    reason: zod_1.z.string().trim().min(1).max(2000),
    durationSeconds: (0, validate_1.zInt)({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(),
    permanent: zod_1.z.boolean().optional(),
});
exports.hkBansRouter.post("/", (0, validate_1.validateBody)(bCreate), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const staff = req.user;
    const now = Math.floor(Date.now() / 1000);
    let banExpire = 0;
    if (body.permanent)
        banExpire = 0;
    else if (body.durationSeconds)
        banExpire = now + Number(body.durationSeconds);
    else
        throw (0, ApiError_1.badRequest)("Provide durationSeconds or permanent=true");
    const type = String(body.bantype);
    const userId = body.user_id ? Number(body.user_id) : null;
    const ip = body.ip ? String(body.ip) : null;
    const machineId = body.machine_id ? String(body.machine_id) : null;
    if (type === "account" && !userId)
        throw (0, ApiError_1.badRequest)("user_id is required for account bans.");
    if (type === "ip" && !ip)
        throw (0, ApiError_1.badRequest)("ip is required for IP bans.");
    if (type === "machine" && !machineId)
        throw (0, ApiError_1.badRequest)("machine_id is required for machine bans.");
    if (type === "super" && !userId && !ip && !machineId) {
        throw (0, ApiError_1.badRequest)("Provide at least one of user_id, ip, or machine_id for super bans.");
    }
    await db_1.pool.query(`
      INSERT INTO bans (
        user_id,
        ip,
        machine_id,
        user_staff_id,
        timestamp,
        ban_expire,
        ban_reason,
        type,
        cfh_topic
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, ip, machineId, Number(staff.id), now, Number(banExpire), String(body.reason), type, -1]);
    return (0, response_1.ok)(res, { created: true });
}));
const pId = zod_1.z.object({ id: (0, validate_1.zInt)({ min: 1 }) });
const bUpdate = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1).max(2000).optional(),
    durationSeconds: (0, validate_1.zInt)({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(),
    permanent: zod_1.z.boolean().optional(),
});
exports.hkBansRouter.put("/:id", (0, validate_1.validateParams)(pId), (0, validate_1.validateBody)(bUpdate), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const [check] = await db_1.pool.query(`SELECT id FROM bans WHERE id = ? LIMIT 1`, [Number(id)]);
    const exists = check?.[0];
    if (!exists)
        throw (0, ApiError_1.notFound)("Ban not found.");
    const sets = [];
    const params = [];
    if (body.reason) {
        sets.push("ban_reason = ?");
        params.push(String(body.reason));
    }
    if (body.permanent === true) {
        sets.push("ban_expire = 0");
    }
    else if (body.durationSeconds) {
        sets.push("ban_expire = ?");
        params.push(Math.floor(Date.now() / 1000) + Number(body.durationSeconds));
    }
    if (!sets.length)
        throw (0, ApiError_1.badRequest)("No fields to update.");
    await db_1.pool.query(`UPDATE bans SET ${sets.join(", ")} WHERE id = ?`, [...params, Number(id)]);
    return (0, response_1.ok)(res, { updated: true });
}));
exports.hkBansRouter.delete("/:id", (0, validate_1.validateParams)(pId), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const [result] = await db_1.pool.query(`DELETE FROM bans WHERE id = ?`, [Number(id)]);
    const affected = result?.affectedRows ?? 0;
    if (!affected)
        throw (0, ApiError_1.notFound)("Ban not found.");
    return (0, response_1.ok)(res, { deleted: true });
}));

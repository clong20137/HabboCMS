import express from "express";
import { z } from "zod";
import { pool } from "../../db";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireStaff } from "../../auth";
import { validateBody, validateQuery, validateParams, zInt } from "../../middleware/validate";
import { ok } from "../../utils/response";
import { badRequest, notFound } from "../../errors/ApiError";

export const hkBansRouter = express.Router();

hkBansRouter.use(requireAuth);
hkBansRouter.use(requireStaff(4));

const qList = z.object({
  q: z.string().trim().max(64).optional(),
  bantype: z.enum(["account", "ip", "machine", "super"]).optional(),
  limit: zInt({ min: 1, max: 200 }).optional().default(50),
});

hkBansRouter.get(
  "/",
  validateQuery(qList),
  asyncHandler(async (req, res) => {
    const { q, bantype, limit } = req.query as any;

    const where: string[] = [];
    const params: any[] = [];

    if (bantype) {
      where.push("type = ?");
      params.push(bantype);
    }

    if (q) {
      where.push("(CAST(user_id AS CHAR) LIKE ? OR ip LIKE ? OR machine_id LIKE ? OR ban_reason LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await (pool as any).query(
      `
      SELECT id, user_id, ip, machine_id, user_staff_id, timestamp, ban_expire, ban_reason, type, cfh_topic
      FROM bans
      ${whereSql}
      ORDER BY id DESC
      LIMIT ?
      `,
      [...params, Number(limit)],
    );

    return ok(res, { items: rows || [] });
  }),
);

const bCreate = z.object({
  bantype: z.enum(["account", "ip", "machine", "super"]),
  user_id: z.number().int().positive().optional(),
  ip: z.string().trim().max(45).optional(),
  machine_id: z.string().trim().max(255).optional(),
  reason: z.string().trim().min(1).max(2000),
  durationSeconds: zInt({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(),
  permanent: z.boolean().optional(),
});

hkBansRouter.post(
  "/",
  validateBody(bCreate),
  asyncHandler(async (req, res) => {
    const body = req.body as any;
    const staff = (req as any).user as { id: number; username: string };
    const now = Math.floor(Date.now() / 1000);

    let banExpire = 0;
    if (body.permanent) banExpire = 0;
    else if (body.durationSeconds) banExpire = now + Number(body.durationSeconds);
    else throw badRequest("Provide durationSeconds or permanent=true");

    const type = String(body.bantype);
    const userId = body.user_id ? Number(body.user_id) : null;
    const ip = body.ip ? String(body.ip) : null;
    const machineId = body.machine_id ? String(body.machine_id) : null;

    if (type === "account" && !userId) throw badRequest("user_id is required for account bans.");
    if (type === "ip" && !ip) throw badRequest("ip is required for IP bans.");
    if (type === "machine" && !machineId) throw badRequest("machine_id is required for machine bans.");
    if (type === "super" && !userId && !ip && !machineId) {
      throw badRequest("Provide at least one of user_id, ip, or machine_id for super bans.");
    }

    await (pool as any).query(
      `
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
      `,
      [userId, ip, machineId, Number(staff.id), now, Number(banExpire), String(body.reason), type, -1],
    );

    return ok(res, { created: true });
  }),
);

const pId = z.object({ id: zInt({ min: 1 }) });

const bUpdate = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
  durationSeconds: zInt({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(),
  permanent: z.boolean().optional(),
});

hkBansRouter.put(
  "/:id",
  validateParams(pId),
  validateBody(bUpdate),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const body = req.body as any;

    const [check] = await (pool as any).query(`SELECT id FROM bans WHERE id = ? LIMIT 1`, [Number(id)]);
    const exists = (check as any[])?.[0];
    if (!exists) throw notFound("Ban not found.");

    const sets: string[] = [];
    const params: any[] = [];

    if (body.reason) {
      sets.push("ban_reason = ?");
      params.push(String(body.reason));
    }

    if (body.permanent === true) {
      sets.push("ban_expire = 0");
    } else if (body.durationSeconds) {
      sets.push("ban_expire = ?");
      params.push(Math.floor(Date.now() / 1000) + Number(body.durationSeconds));
    }

    if (!sets.length) throw badRequest("No fields to update.");

    await (pool as any).query(`UPDATE bans SET ${sets.join(", ")} WHERE id = ?`, [...params, Number(id)]);
    return ok(res, { updated: true });
  }),
);

hkBansRouter.delete(
  "/:id",
  validateParams(pId),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const [result] = await (pool as any).query(`DELETE FROM bans WHERE id = ?`, [Number(id)]);
    const affected = (result as any)?.affectedRows ?? 0;
    if (!affected) throw notFound("Ban not found.");
    return ok(res, { deleted: true });
  }),
);

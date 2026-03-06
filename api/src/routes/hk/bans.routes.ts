import express from "express";
import { z } from "zod";
import { pool } from "../../db";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireStaff } from "../../auth";
import {
  validateBody,
  validateQuery,
  validateParams,
  zInt,
} from "../../middleware/validate";
import { ok } from "../../utils/response";
import { badRequest, notFound } from "../../errors/ApiError";

/**
 * bans table (from your screenshot):
 * id (int)
 * bantype enum('user','ip','machine')
 * value varchar(50)
 * reason text
 * expire double (unix seconds). 0 = permanent
 * added_by varchar(45)
 * added_date int (unix seconds)
 * appeal_state enum('0','1','2')
 */

export const hkBansRouter = express.Router();

// Basic HK guard: must be logged in and staff
hkBansRouter.use(requireAuth);
hkBansRouter.use(requireStaff(4));

const qList = z.object({
  q: z.string().trim().max(64).optional(),
  bantype: z.enum(["user", "ip", "machine"]).optional(),
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
      where.push("bantype = ?");
      params.push(bantype);
    }

    if (q) {
      // search by value (username/ip/machine) or reason text
      where.push("(value LIKE ? OR reason LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await (pool as any).query(
      `
SELECT
id, bantype, value, reason, expire, added_by, added_date, appeal_state
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
  bantype: z.enum(["user", "ip", "machine"]),
  value: z.string().trim().min(1).max(50),
  reason: z.string().trim().min(1).max(2000),
  // one of these:
  durationSeconds: zInt({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(), // up to 5 years
  permanent: z.boolean().optional(),
});

hkBansRouter.post(
  "/",
  validateBody(bCreate),
  asyncHandler(async (req, res) => {
    const body = req.body as any;
    const staff = (req as any).user as { id: number; username: string };

    const now = Math.floor(Date.now() / 1000);

    let expire = 0;
    if (body.permanent) {
      expire = 0;
    } else if (body.durationSeconds) {
      expire = now + Number(body.durationSeconds);
    } else {
      throw badRequest("Provide durationSeconds or permanent=true");
    }

    await (pool as any).query(
      `
INSERT INTO bans (bantype, value, reason, expire, added_by, added_date, appeal_state)
VALUES (?, ?, ?, ?, ?, ?, '0')
`,
      [
        String(body.bantype),
        String(body.value),
        String(body.reason),
        Number(expire),
        String(staff.username || staff.id),
        Number(now),
      ],
    );

    return ok(res, { created: true });
  }),
);

const pId = z.object({ id: zInt({ min: 1 }) });

const bUpdate = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
  // change expiry:
  durationSeconds: zInt({ min: 1, max: 60 * 60 * 24 * 365 * 5 }).optional(),
  permanent: z.boolean().optional(),
  appeal_state: z.enum(["0", "1", "2"]).optional(),
});

hkBansRouter.put(
  "/:id",
  validateParams(pId),
  validateBody(bUpdate),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const body = req.body as any;

    // ensure exists
    const [check] = await (pool as any).query(
      `SELECT id, expire FROM bans WHERE id = ? LIMIT 1`,
      [Number(id)],
    );
    const exists = (check as any[])?.[0];
    if (!exists) throw notFound("Ban not found.");

    const sets: string[] = [];
    const params: any[] = [];

    if (body.reason) {
      sets.push("reason = ?");
      params.push(String(body.reason));
    }

    if (body.appeal_state !== undefined) {
      sets.push("appeal_state = ?");
      params.push(String(body.appeal_state));
    }

    if (body.permanent === true) {
      sets.push("expire = 0");
    } else if (body.durationSeconds) {
      const now = Math.floor(Date.now() / 1000);
      sets.push("expire = ?");
      params.push(now + Number(body.durationSeconds));
    }

    if (!sets.length) throw badRequest("No fields to update.");

    await (pool as any).query(
      `UPDATE bans SET ${sets.join(", ")} WHERE id = ?`,
      [...params, Number(id)],
    );

    return ok(res, { updated: true });
  }),
);

hkBansRouter.delete(
  "/:id",
  validateParams(pId),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;

    const [result] = await (pool as any).query(
      `DELETE FROM bans WHERE id = ?`,
      [Number(id)],
    );

    // mysql2: affectedRows
    const affected = (result as any)?.affectedRows ?? 0;
    if (!affected) throw notFound("Ban not found.");

    return ok(res, { deleted: true });
  }),
);

import type { Request } from "express";
import { pool } from "../db";

export async function hkAudit(
  req: Request,
  payload: {
    action: string;
    targetType?: string;
    targetId?: string | number;
    details?: any;
  },
) {
  const u = req.hkUser!;

  const xf = String(req.headers["x-forwarded-for"] || "");
  const forwardedIp = xf ? xf.split(",")[0]?.trim() : "";
  const ip = forwardedIp || req.ip || req.socket.remoteAddress || null;

  let detailsJson: string | null = null;
  if (payload.details != null) {
    try {
      detailsJson = JSON.stringify(payload.details);
    } catch {
      detailsJson = JSON.stringify({ error: "details_not_serializable" });
    }
  }

  await pool.query(
    `INSERT INTO hk_audit_log
(actor_id, actor_name, actor_rank, action, target_type, target_id, details_json, ip)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      u.id,
      u.username,
      u.rank,
      payload.action,
      payload.targetType || null,
      payload.targetId != null ? String(payload.targetId) : null,
      detailsJson,
      ip,
    ],
  );
}

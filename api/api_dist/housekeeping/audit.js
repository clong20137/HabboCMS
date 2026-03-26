"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hkAudit = hkAudit;
const db_1 = require("../db");
async function hkAudit(req, payload) {
    const u = req.hkUser;
    const xf = String(req.headers["x-forwarded-for"] || "");
    const forwardedIp = xf ? xf.split(",")[0]?.trim() : "";
    const ip = forwardedIp || req.ip || req.socket.remoteAddress || null;
    let detailsJson = null;
    if (payload.details != null) {
        try {
            detailsJson = JSON.stringify(payload.details);
        }
        catch {
            detailsJson = JSON.stringify({ error: "details_not_serializable" });
        }
    }
    await db_1.pool.query(`INSERT INTO hk_audit_log
(actor_id, actor_name, actor_rank, action, target_type, target_id, details_json, ip)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        u.id,
        u.username,
        u.rank,
        payload.action,
        payload.targetType || null,
        payload.targetId != null ? String(payload.targetId) : null,
        detailsJson,
        ip,
    ]);
}

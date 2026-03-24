"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBanStatus = getBanStatus;
const db_1 = require("../db");
function parseExpireToIso(expire) {
    const n = Number(expire);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return new Date(n * 1000).toISOString();
}
function isActive(expire) {
    const n = Number(expire);
    if (!Number.isFinite(n) || n <= 0)
        return true;
    return n > Math.floor(Date.now() / 1000);
}
async function getBanStatus(opts) {
    try {
        const where = [];
        const params = [];
        if (opts.userId != null) {
            where.push("(type = 'account' AND user_id = ?)");
            params.push(opts.userId);
            where.push("(type = 'super' AND user_id = ?)");
            params.push(opts.userId);
        }
        if (opts.ip) {
            where.push("(type = 'ip' AND ip = ?)");
            params.push(opts.ip);
            where.push("(type = 'super' AND ip = ?)");
            params.push(opts.ip);
        }
        if (opts.machine) {
            where.push("(type = 'machine' AND machine_id = ?)");
            params.push(opts.machine);
            where.push("(type = 'super' AND machine_id = ?)");
            params.push(opts.machine);
        }
        if (!where.length)
            return { banned: false };
        const [rows] = await db_1.pool.query(`
      SELECT type, ban_reason, ban_expire
      FROM bans
      WHERE ${where.join(" OR ")}
      ORDER BY id DESC
      LIMIT 25
      `, params);
        for (const row of rows || []) {
            if (!isActive(row.ban_expire))
                continue;
            return {
                banned: true,
                bantype: String(row.type),
                reason: String(row.ban_reason || "You are banned."),
                expiresAt: parseExpireToIso(row.ban_expire),
            };
        }
        return { banned: false };
    }
    catch (err) {
        console.error("[ban] getBanStatus failed:", err);
        return { banned: false };
    }
}

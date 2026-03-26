"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLogin = recordLogin;
exports.getLoginHistory = getLoginHistory;
function getClientIp(req) {
    const xf = String(req.headers["x-forwarded-for"] || "").trim();
    if (xf)
        return xf.split(",")[0].trim();
    // express sets req.ip sometimes; fallback to socket
    return String(req.ip || req.socket?.remoteAddress || "unknown");
}
async function recordLogin(opts) {
    const { pool, req, userId, authMethod } = opts;
    const success = opts.success ?? true;
    const ip = getClientIp(req);
    const ua = String(req.headers["user-agent"] || "").slice(0, 255) || null;
    await pool.query(`INSERT INTO login_history (user_id, ip, user_agent, auth_method, success)
VALUES (?, ?, ?, ?, ?)`, [userId, ip, ua, authMethod, success ? 1 : 0]);
}
async function getLoginHistory(pool, userId, limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
    const [rows] = (await pool.query(`SELECT id, created_at, ip, user_agent, auth_method, success
FROM login_history
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ?`, [userId, safeLimit]));
    return (rows || []).map((r) => ({
        id: Number(r.id),
        createdAt: new Date(r.created_at).toISOString(),
        ip: String(r.ip || ""),
        userAgent: r.user_agent ? String(r.user_agent) : null,
        authMethod: String(r.auth_method) === "2fa" ? "2fa" : "password",
        success: Number(r.success) === 1,
    }));
}

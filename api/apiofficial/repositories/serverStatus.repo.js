"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnlineCount = getOnlineCount;
/**
 * Returns current online count.
 * Primary: server_status.users_online
 * Fallback: COUNT(*) FROM users WHERE online = 1
 */
async function getOnlineCount(pool) {
    // Primary
    try {
        const [rows] = await pool.query("SELECT users_online FROM server_status LIMIT 1");
        return rows.length ? Number(rows[0].users_online ?? 0) : 0;
    }
    catch (err) {
        // Fallback if table/column is missing (or any SQL error in legacy installs)
        // ER_NO_SUCH_TABLE = 1146, ER_BAD_FIELD_ERROR = 1054
        const code = err?.code;
        const errno = Number(err?.errno);
        if (code !== "ER_NO_SUCH_TABLE" && code !== "ER_BAD_FIELD_ERROR" && errno !== 1146 && errno !== 1054) {
            // Still try fallback; if that fails too, rethrow the original
        }
    }
    // Fallback
    try {
        const [rows] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE online = 1");
        return rows.length ? Number(rows[0].c ?? 0) : 0;
    }
    catch {
        // Final fallback: avoid taking down the whole site
        return 0;
    }
}

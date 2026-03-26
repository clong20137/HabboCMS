"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLiveFeed = listLiveFeed;
async function listLiveFeed(pool, limit) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
    const [rows] = await pool.query(`
      SELECT id, username, avatar_url, content, tag, created_at
      FROM rp_live_feed
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `, [safeLimit]);
    return rows;
}

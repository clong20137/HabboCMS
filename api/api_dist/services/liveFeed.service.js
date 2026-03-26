"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveFeed = getLiveFeed;
const liveFeed_repo_1 = require("../repositories/liveFeed.repo");
async function getLiveFeed(pool, limit) {
    const rows = await (0, liveFeed_repo_1.listLiveFeed)(pool, limit);
    return rows.map((row) => ({
        id: Number(row.id),
        username: row.username ?? null,
        avatar_url: row.avatar_url ?? null,
        content: String(row.content ?? ""),
        tag: row.tag ?? null,
        created_at: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at ?? ""),
    }));
}

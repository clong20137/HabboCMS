import type { Pool } from "mysql2/promise";

import { listLiveFeed } from "../repositories/liveFeed.repo";

export async function getLiveFeed(pool: Pool, limit: number) {
  const rows = await listLiveFeed(pool, limit);

  return rows.map((row) => ({
    id: Number(row.id),
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    content: String(row.content ?? ""),
    tag: row.tag ?? null,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? ""),
  }));
}

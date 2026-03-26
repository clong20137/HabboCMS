import type { Pool, RowDataPacket } from "mysql2/promise";

export type LiveFeedRow = RowDataPacket & {
  id: number;
  username: string | null;
  avatar_url: string | null;
  content: string;
  tag: string | null;
  created_at: Date | string;
};

export async function listLiveFeed(pool: Pool, limit: number) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;

  const [rows] = await pool.query<LiveFeedRow[]>(
    `
      SELECT id, username, avatar_url, content, tag, created_at
      FROM rp_live_feed
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [safeLimit],
  );

  return rows;
}

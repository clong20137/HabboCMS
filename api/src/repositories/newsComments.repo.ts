import type { Pool, ResultSetHeader } from "mysql2/promise";

import type { NewsCommentRow } from "../types/db/rows";

export async function listCommentsForNews(
  pool: Pool,
  params: { newsId: number; limit: number },
): Promise<NewsCommentRow[]> {
  const [rows] = await pool.query<NewsCommentRow[]>(
    `
SELECT c.id, c.news_id, c.user_id, u.username, c.body, c.created_at
FROM news_comments c
JOIN users u ON u.id = c.user_id
WHERE c.news_id = ?
ORDER BY c.created_at DESC
LIMIT ?
`,
    [params.newsId, params.limit],
  );
  return rows;
}

export async function insertComment(
  pool: Pool,
  params: { newsId: number; userId: number; body: string },
): Promise<number> {
  const [ins] = await pool.query<ResultSetHeader>(
    `
INSERT INTO news_comments (news_id, user_id, body, created_at)
VALUES (?, ?, ?, NOW())
`,
    [params.newsId, params.userId, params.body],
  );
  return Number(ins.insertId);
}

export async function commentExists(pool: Pool, commentId: number): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    "SELECT id FROM news_comments WHERE id = ? LIMIT 1",
    [commentId],
  );
  return rows.length > 0;
}

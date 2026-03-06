import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import type { MyReactionRow, ReactionCountRow } from "../types/db/rows";

export async function getReactionCountsByCommentIds(
  pool: Pool,
  commentIds: number[],
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT comment_id, reaction, COUNT(*) AS cnt
FROM news_comment_reactions
WHERE comment_id IN (?)
GROUP BY comment_id, reaction
`,
    [commentIds],
  );
  return rows;
}

export async function getMyReactionsForCommentIds(
  pool: Pool,
  params: { userId: number; commentIds: number[] },
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT comment_id, reaction
FROM news_comment_reactions
WHERE user_id = ? AND comment_id IN (?)
`,
    [params.userId, params.commentIds],
  );
  return rows;
}

export async function findExistingReaction(
  pool: Pool | PoolConnection,
  params: { commentId: number; userId: number; reaction: string },
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT id FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ? AND reaction = ?
LIMIT 1
`,
    [params.commentId, params.userId, params.reaction],
  );
  return rows.length > 0;
}

export async function deleteReaction(
  pool: Pool | PoolConnection,
  params: { commentId: number; userId: number; reaction: string },
): Promise<void> {
  await pool.query(
    `
DELETE FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ? AND reaction = ?
LIMIT 1
`,
    [params.commentId, params.userId, params.reaction],
  );
}

export async function insertReaction(
  pool: Pool | PoolConnection,
  params: { commentId: number; userId: number; reaction: string },
): Promise<void> {
  await pool.query(
    `
INSERT INTO news_comment_reactions (comment_id, user_id, reaction, created_at)
VALUES (?, ?, ?, NOW())
`,
    [params.commentId, params.userId, params.reaction],
  );
}

export async function getReactionCountsForComment(
  pool: Pool,
  commentId: number,
): Promise<ReactionCountRow[]> {
  const [rows] = await pool.query<ReactionCountRow[]>(
    `
SELECT reaction, COUNT(*) AS cnt
FROM news_comment_reactions
WHERE comment_id = ?
GROUP BY reaction
`,
    [commentId],
  );
  return rows;
}

export async function getMyReactionsForComment(
  pool: Pool,
  params: { commentId: number; userId: number },
): Promise<MyReactionRow[]> {
  const [rows] = await pool.query<MyReactionRow[]>(
    `
SELECT reaction
FROM news_comment_reactions
WHERE comment_id = ? AND user_id = ?
`,
    [params.commentId, params.userId],
  );
  return rows;
}

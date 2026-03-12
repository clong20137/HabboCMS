import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { NewsCommentRow } from "../types/db/rows";

let newsCommentsColumnsCache: { at: number; cols: Set<string> } | null = null;
const NEWS_COMMENTS_COL_CACHE_MS = 60_000;

async function getNewsCommentsColumns(pool: Pool): Promise<Set<string>> {
  const now = Date.now();

  if (
    newsCommentsColumnsCache &&
    now - newsCommentsColumnsCache.at < NEWS_COMMENTS_COL_CACHE_MS
  ) {
    return newsCommentsColumnsCache.cols;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM news_comments",
  );

  const cols = new Set<string>(rows.map((r: any) => String(r.Field)));
  newsCommentsColumnsCache = { at: now, cols };
  return cols;
}

export async function listCommentsForNews(
  pool: Pool,
  params: { newsId: number; limit: number },
): Promise<NewsCommentRow[]> {
  const cols = await getNewsCommentsColumns(pool);

  const bodyExpr = cols.has("body")
    ? "c.body"
    : cols.has("message")
      ? "c.message AS body"
      : cols.has("comment")
        ? "c.comment AS body"
        : cols.has("content")
          ? "c.content AS body"
          : "'' AS body";

  const createdExpr = cols.has("created_at")
    ? "c.created_at"
    : cols.has("createdAt")
      ? "c.createdAt AS created_at"
      : cols.has("timestamp")
        ? "c.timestamp AS created_at"
        : "NULL AS created_at";

  const usernameExpr = cols.has("username") ? "c.username" : "u.username";

  const orderExpr = cols.has("created_at")
    ? "c.created_at DESC"
    : cols.has("createdAt")
      ? "c.createdAt DESC"
      : cols.has("timestamp")
        ? "c.timestamp DESC"
        : "c.id DESC";

  const [rows] = await pool.query<NewsCommentRow[]>(
    `
SELECT
c.id,
c.news_id,
c.user_id,
${usernameExpr} AS username,
${bodyExpr},
${createdExpr}
FROM news_comments c
LEFT JOIN users u ON u.id = c.user_id
WHERE c.news_id = ?
ORDER BY ${orderExpr}
LIMIT ?
`,
    [params.newsId, params.limit],
  );

  return rows;
}

export async function insertComment(
  pool: Pool,
  params: { newsId: number; userId: number; username: string; body: string },
): Promise<number> {
  const cols = await getNewsCommentsColumns(pool);

  const insertCols: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];

  if (cols.has("news_id")) {
    insertCols.push("news_id");
    placeholders.push("?");
    values.push(params.newsId);
  }

  if (cols.has("user_id")) {
    insertCols.push("user_id");
    placeholders.push("?");
    values.push(params.userId);
  }

  if (cols.has("username")) {
    insertCols.push("username");
    placeholders.push("?");
    values.push(params.username);
  }

  if (cols.has("body")) {
    insertCols.push("body");
    placeholders.push("?");
    values.push(params.body);
  } else if (cols.has("message")) {
    insertCols.push("message");
    placeholders.push("?");
    values.push(params.body);
  } else if (cols.has("comment")) {
    insertCols.push("comment");
    placeholders.push("?");
    values.push(params.body);
  } else if (cols.has("content")) {
    insertCols.push("content");
    placeholders.push("?");
    values.push(params.body);
  } else {
    throw new Error("news_comments table is missing a supported body column.");
  }

  if (cols.has("created_at")) {
    insertCols.push("created_at");
    placeholders.push("NOW()");
  } else if (cols.has("createdAt")) {
    insertCols.push("createdAt");
    placeholders.push("NOW()");
  } else if (cols.has("timestamp")) {
    insertCols.push("timestamp");
    placeholders.push("UNIX_TIMESTAMP()");
  }

  const [ins] = await pool.query<ResultSetHeader>(
    `
INSERT INTO news_comments (${insertCols.join(", ")})
VALUES (${placeholders.join(", ")})
`,
    values,
  );

  return Number(ins.insertId);
}

export async function commentExists(
  pool: Pool,
  commentId: number,
): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    "SELECT id FROM news_comments WHERE id = ? LIMIT 1",
    [commentId],
  );
  return rows.length > 0;
}

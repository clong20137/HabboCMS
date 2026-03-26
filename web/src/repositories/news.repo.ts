import type { Pool, RowDataPacket } from "mysql2/promise";

import type { NewsRow } from "../types/db/rows";

export async function listNews(pool: Pool, limit: number): Promise<NewsRow[]> {
  const [rows] = await pool.query<NewsRow[]>(
    `
SELECT id, title, description, image_url, author, created_at
FROM news
ORDER BY created_at DESC
LIMIT ?
`,
    [limit],
  );
  return rows;
}

export async function getNewsById(pool: Pool, id: number): Promise<NewsRow | null> {
  const [rows] = await pool.query<NewsRow[]>(
    `
SELECT id, title, description, story_html AS story, image_url, author, created_at
FROM news
WHERE id = ?
LIMIT 1
`,
    [id],
  );
  return rows.length ? rows[0] : null;
}

export async function listRecentNewsExcluding(
  pool: Pool,
  currentId: number,
  limit: number,
): Promise<NewsRow[]> {
  const [rows] = await pool.query<NewsRow[]>(
    `
SELECT id, title, description, image_url, author, created_at
FROM news
WHERE id <> ?
ORDER BY created_at DESC
LIMIT ?
`,
    [currentId, limit],
  );
  return rows;
}

export async function newsExists(pool: Pool, id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM news WHERE id = ? LIMIT 1",
    [id],
  );
  return rows.length > 0;
}

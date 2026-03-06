import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { UserRow } from "../types/db/rows";

// Cache detected columns for a short period to avoid hitting SHOW COLUMNS on every request.
let usersColumnsCache: { at: number; cols: Set<string> } | null = null;
const USERS_COL_CACHE_MS = 60_000;

async function getUsersColumns(pool: Pool): Promise<Set<string>> {
  const now = Date.now();
  if (usersColumnsCache && now - usersColumnsCache.at < USERS_COL_CACHE_MS) {
    return usersColumnsCache.cols;
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM users");
    const cols = new Set<string>(rows.map((r: any) => String(r.Field)));
    usersColumnsCache = { at: now, cols };
    return cols;
  } catch {
    // If SHOW COLUMNS fails for any reason, return an empty set and let callers fall back.
    const cols = new Set<string>();
    usersColumnsCache = { at: now, cols };
    return cols;
  }
}

export async function usernameExists(
  pool: Pool,
  username: string,
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    [username],
  );
  return rows.length > 0;
}

export async function findUserForLogin(
  pool: Pool,
  username: string,
): Promise<Pick<UserRow, "id" | "username" | "password" | "rank"> | null> {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT id, username, password, `rank` FROM users WHERE username = ? LIMIT 1",
    [username],
  );
  return rows.length ? rows[0] : null;
}

export async function insertUser(
  pool: Pool,
  params: {
    username: string;
    passwordHash: string;
    email: string;
    accountCreatedUnix: string;
    authTicket: string;
  },
): Promise<number> {
  const sql =
    "INSERT INTO users (username, password, mail, account_created, last_online, online, `rank`, rank_vip, credits, vip_points, activity_points, gender, auth_ticket) " +
    "VALUES (?, ?, ?, ?, 0, 0, 1, 1, 50000, 0, 5000, 'M', ?)";

  const [result] = await pool.query<ResultSetHeader>(sql, [
    params.username,
    params.passwordHash,
    params.email,
    params.accountCreatedUnix,
    params.authTicket,
  ]);

  return Number(result.insertId);
}

/**
 * Returns the "me" payload. Some installs won't have the RP columns.
 * We dynamically select only the columns that exist.
 */
export async function getMeById(
  pool: Pool,
  userId: number,
): Promise<UserRow | null> {
  const cols = await getUsersColumns(pool);

  // Always-required columns
  const select: string[] = ["id", "username", "mail", "`rank`"];

  // Optional columns used by the client UI
  const optional = [
    // economy / RP stats you already had
    "credits",
    "bank_amount",
    "kd",
    "kills",
    "deaths",
    "punches_thrown",
    "punches_received",
    "arrests_made",
    "arrests_amount",
    "damage_dealt",
    "damage_received",

    // health/energy
    "health",
    "max_health",
    "energy",
    "max_energy",

    // ✅ NEW: stats + one-time setup gate
    "strength",
    "knowledge",
    "farming",
    "health", // stat column (yes this exists in your table)
    "defense",
    "stamina",
    "points",
    "stats_setup_done",
  ];

  for (const c of optional) {
    if (cols.has(c)) select.push(c);
  }

  const sql = `SELECT ${select.join(", ")} FROM users WHERE id = ? LIMIT 1`;

  try {
    const [rows] = await pool.query<UserRow[]>(sql, [userId]);
    return rows.length ? rows[0] : null;
  } catch {
    // If the query still fails (older schemas), fall back to minimal fields.
    const [rows] = await pool.query<UserRow[]>(
      "SELECT id, username, mail, `rank` FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    return rows.length ? rows[0] : null;
  }
}

export async function updateAuthTicket(
  pool: Pool,
  userId: number,
  authTicket: string,
): Promise<void> {
  await pool.query("UPDATE users SET auth_ticket = ? WHERE id = ? LIMIT 1", [
    authTicket,
    userId,
  ]);
}

export async function listStaff(pool: Pool, minRank: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
SELECT id, username, motto, \`rank\`
FROM users
WHERE \`rank\` >= ?
ORDER BY \`rank\` DESC, username ASC
`,
    [minRank],
  );
  return rows as any[];
}

// Allowed fields to prevent SQL injection through "field"
const LEADERBOARD_FIELDS = new Set([
  "credits",
  "bank_amount",
  "kills",
  "deaths",
  "kd",
  "punches_thrown",
  "punches_received",
  "arrests_made",
  "arrests_amount",
  "damage_dealt",
  "damage_received",
]);

export async function leaderboardByField(
  pool: Pool,
  field: string,
  limit: number,
): Promise<RowDataPacket[]> {
  if (!LEADERBOARD_FIELDS.has(field)) return [];

  const cols = await getUsersColumns(pool);
  if (!cols.has(field)) return [];

  const sql = `
SELECT id, username, ${field} AS value
FROM users
WHERE ${field} IS NOT NULL
ORDER BY ${field} DESC
LIMIT ?
`;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(sql, [limit]);
    return rows;
  } catch {
    return [];
  }
}

export async function updatePasswordHash(
  pool: Pool,
  userId: number,
  passwordHash: string,
): Promise<void> {
  await pool.query("UPDATE users SET password = ? WHERE id = ? LIMIT 1", [
    passwordHash,
    userId,
  ]);
}

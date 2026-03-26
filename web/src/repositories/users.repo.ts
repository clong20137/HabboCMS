import crypto from "crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { UserRow } from "../types/db/rows";

type ColumnCache = { at: number; cols: Set<string> };

let usersColumnsCache: ColumnCache | null = null;
let userStatsColumnsCache: ColumnCache | null = null;

const COL_CACHE_MS = 60_000;

async function getTableColumns(
pool: Pool,
tableName: string,
): Promise<Set<string>> {
const now = Date.now();

if (
tableName === "users" &&
usersColumnsCache &&
now - usersColumnsCache.at < COL_CACHE_MS
) {
return usersColumnsCache.cols;
}

if (
tableName === "user_stats" &&
userStatsColumnsCache &&
now - userStatsColumnsCache.at < COL_CACHE_MS
) {
return userStatsColumnsCache.cols;
}

try {
const [rows] = await pool.query<RowDataPacket[]>(
`SHOW COLUMNS FROM \`${tableName}\``,
);
const cols = new Set<string>(rows.map((r: any) => String(r.Field)));

const cache = { at: now, cols };

if (tableName === "users") usersColumnsCache = cache;
if (tableName === "user_stats") userStatsColumnsCache = cache;

return cols;
} catch {
const cols = new Set<string>();
const cache = { at: now, cols };

if (tableName === "users") usersColumnsCache = cache;
if (tableName === "user_stats") userStatsColumnsCache = cache;

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
ip: string;
},
): Promise<number> {
const authTicket = `CMS-${crypto.randomBytes(32).toString("hex")}`;

const sql = `
INSERT INTO users (
username,
password,
mail,
account_created,
ip_register,
ip_current,
auth_ticket,
\`rank\`,
credits
)
VALUES (?, ?, ?, ?, ?, ?, ?, 1, 50000)
`;

const [result] = await pool.query<ResultSetHeader>(sql, [
params.username,
params.passwordHash,
params.email,
params.accountCreatedUnix,
params.ip,
params.ip,
authTicket,
]);

const userId = Number(result.insertId);

await pool.query(
`
INSERT INTO user_stats (
user_id,
punches_thrown,
punches_landed,
damage_inflicted,
damage_received,
shifts_worked,
kills,
deaths,
robberies,
arrests,
strength,
energy,
stamina,
hunger,
current_health,
max_health,
is_dead,
xp,
max_xp,
max_energy,
max_hunger,
shifts_completed,
aggression,
level,
stat_points,
hunger_level,
gathering,
defense,
virtual_room_id,
is_passive,
name_icon_id,
bank_credits,
last_room_id,
last_x,
last_y,
last_z,
arena_wins,
arena_losses,
knowledge,
stats_setup_done
)
VALUES (
?, 0, 0, 0, 0, 0, 0, 0, 0, 0,
0, 0, 0, 0, 100, 100, 0, 0, 60, 100,
100, 0, 0, 0, 0, 0, 0, 0, 1, 0,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0
)
`,
[userId],
);

return userId;
}

/**
* Returns the "me" payload using Arcturus-compatible users + user_stats tables.
*/
export async function getMeById(
pool: Pool,
userId: number,
): Promise<UserRow | null> {
const userCols = await getTableColumns(pool, "users");
const statsCols = await getTableColumns(pool, "user_stats");

const select: string[] = ["u.id", "u.username", "u.mail", "u.`rank`"];

const userOptional: Array<[string, string]> = [
["credits", "u.credits"],
["motto", "u.motto"],
["look", "u.look"],
["auth_ticket", "u.auth_ticket"],
];

const statsOptional: Array<[string, string]> = [
["punches_thrown", "us.punches_thrown"],
["punches_landed", "us.punches_landed"],
["damage_inflicted", "us.damage_inflicted"],
["damage_received", "us.damage_received"],
["kills", "us.kills"],
["deaths", "us.deaths"],
["robberies", "us.robberies"],
["arrests", "us.arrests"],

["strength", "us.strength"],
["defense", "us.defense"],
["stamina", "us.stamina"],
["gathering", "us.gathering"],
["knowledge", "us.knowledge"],

["energy", "us.energy"],
["max_energy", "us.max_energy"],
["hunger", "us.hunger"],
["max_hunger", "us.max_hunger"],
["current_health", "us.current_health"],
["max_health", "us.max_health"],
["is_dead", "us.is_dead"],

["xp", "us.xp"],
["max_xp", "us.max_xp"],
["stat_points", "us.stat_points"],
["stats_setup_done", "us.stats_setup_done"],

["bank_credits", "us.bank_credits"],
["arena_wins", "us.arena_wins"],
["arena_losses", "us.arena_losses"],
["is_passive", "us.is_passive"],
["virtual_room_id", "us.virtual_room_id"],
];

for (const [col, expr] of userOptional) {
if (userCols.has(col)) select.push(expr);
}

for (const [col, expr] of statsOptional) {
if (statsCols.has(col)) select.push(expr);
}

const sql = `
SELECT ${select.join(", ")}
FROM users u
LEFT JOIN user_stats us ON us.user_id = u.id
WHERE u.id = ?
LIMIT 1
`;

try {
const [rows] = await pool.query<UserRow[]>(sql, [userId]);
return rows.length ? rows[0] : null;
} catch {
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

const USER_LEADERBOARD_FIELDS = new Set(["credits"]);

const USER_STATS_LEADERBOARD_FIELDS = new Set([
"bank_credits",
"kills",
"deaths",
"punches_thrown",
"punches_landed",
"damage_inflicted",
"damage_received",
"robberies",
"arrests",
"xp",
"arena_wins",
"arena_losses",
"strength",
"defense",
"stamina",
"gathering",
"knowledge",
]);

export async function leaderboardByField(
pool: Pool,
field: string,
limit: number,
): Promise<RowDataPacket[]> {
const safeLimit = Number.isFinite(limit)
? Math.max(1, Math.min(100, limit))
: 10;

if (USER_LEADERBOARD_FIELDS.has(field)) {
const sql = `
SELECT id, username, ${field} AS value
FROM users
WHERE ${field} IS NOT NULL
AND COALESCE(\`rank\`, 1) < 4
ORDER BY ${field} DESC
LIMIT ?
`;

try {
const [rows] = await pool.query<RowDataPacket[]>(sql, [safeLimit]);
return rows;
} catch {
return [];
}
}

if (USER_STATS_LEADERBOARD_FIELDS.has(field)) {
const sql = `
SELECT u.id, u.username, us.${field} AS value
FROM user_stats us
INNER JOIN users u ON u.id = us.user_id
WHERE us.${field} IS NOT NULL
AND COALESCE(u.\`rank\`, 1) < 4
ORDER BY us.${field} DESC
LIMIT ?
`;

try {
const [rows] = await pool.query<RowDataPacket[]>(sql, [safeLimit]);
return rows;
} catch {
return [];
}
}

return [];
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

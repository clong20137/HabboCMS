import type { Pool } from "mysql2/promise";

import { AppError } from "../errors/AppError";
import { leaderboardByField } from "../repositories/users.repo";

export const LEADERBOARD_FIELDS = new Set([
  "credits",
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

export async function getLeaderboard(
  pool: Pool,
  params: { field: string; limit: number },
) {
  if (!LEADERBOARD_FIELDS.has(params.field)) {
    throw new AppError(400, "Invalid leaderboard field.", { code: "BAD_REQUEST" });
  }

  const rows = await leaderboardByField(pool, params.field, params.limit);
  return rows.map((r: any) => ({
    id: Number(r.id),
    username: String(r.username),
    value: Number(r.value ?? 0),
  }));
}

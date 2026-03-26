import type { Pool } from "mysql2/promise";

import { listStaff } from "../repositories/users.repo";

export async function getStaff(pool: Pool, minRank: number) {
  const rows = await listStaff(pool, minRank);
  return rows.map((u: any) => ({
    id: Number(u.id),
    username: String(u.username),
    motto: u.motto ?? null,
    rank: Number(u.rank ?? 0),
    figure: u.look ?? null,
  }));
}

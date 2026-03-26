import type { Pool, RowDataPacket } from "mysql2/promise";

export async function findUnusedBetaKeyIdByCode(pool: Pool, code: string): Promise<number | null> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM beta_keys WHERE code = ? AND used = 0 LIMIT 1",
      [code],
    );

    if (!rows.length) return null;
    return Number((rows[0] as any).id);
  } catch {
    // beta_keys missing or query fails -> behave as if no valid key
    return null;
  }
}

export async function markBetaKeyUsed(
  pool: Pool,
  params: { betaKeyId: number; usedByUserId: number },
): Promise<void> {
  try {
    await pool.query(
      "UPDATE beta_keys SET used = 1, used_by = ?, used_at = NOW() WHERE id = ? AND used = 0 LIMIT 1",
      [params.usedByUserId, params.betaKeyId],
    );
  } catch {
    // ignore if table is missing; registration will still succeed in non-beta mode
  }
}

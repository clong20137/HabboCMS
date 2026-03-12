import type { Pool, RowDataPacket } from "mysql2/promise";

export type MeCorporationRow = RowDataPacket & {
  corporation_id: number;
  corporation_name: string;
  corporation_icon: string | null;
  can_work_anywhere: number | null;
  rank_id: number | null;
  rank_name: string | null;
  rank_order: number | null;
  is_manager: number | null;
  weekly_shifts: number | null;
  total_shifts: number | null;
};

export async function getCorporationForUser(
  pool: Pool,
  userId: number,
): Promise<MeCorporationRow | null> {
  const [rows] = await pool.query<MeCorporationRow[]>(
    `
SELECT
cm.corporation_id,
c.name AS corporation_name,
c.icon AS corporation_icon,
c.can_work_anywhere,
cm.rank_id,
cr.rank_name,
cr.rank_order,
cm.is_manager,
cm.weekly_shifts,
cm.total_shifts
FROM corporation_members cm
INNER JOIN corporations c
ON c.id = cm.corporation_id
LEFT JOIN corporation_ranks cr
ON cr.id = cm.rank_id
WHERE cm.user_id = ?
LIMIT 1
`,
    [userId],
  );

  return rows.length ? rows[0] : null;
}

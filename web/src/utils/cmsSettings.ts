import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export async function getCmsSetting(
  poolOrConn: Pool | PoolConnection,
  key: string,
  fallback = "",
): Promise<string> {
  try {
    const [rows] = await poolOrConn.query<RowDataPacket[]>(
      "SELECT `setting_value` FROM cms_settings WHERE `setting_key` = ? LIMIT 1",
      [key],
    );
    if (!rows.length) return fallback;
    return String((rows[0] as any).setting_value ?? fallback);
  } catch {
    // If cms_settings table doesn't exist (or any SQL error), don't crash the whole API.
    return fallback;
  }
}

import type { Pool, PoolConnection } from "mysql2/promise";

export async function withTransaction<T>(dbPool: Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    conn.release();
  }
}

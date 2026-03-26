import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import type { RowDataPacket } from "mysql2/promise";

export function requireRank(minRank: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const u = (req as any).user as
        | { id: number; username: string }
        | undefined;
      if (!u?.id) return res.status(401).json({ error: "Unauthorized" });

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT `rank` FROM users WHERE id = ? LIMIT 1",
        [u.id],
      );

      const rank = rows.length ? Number((rows[0] as any).rank ?? 0) : 0;

      // attach for later use if you want
      (req as any).user.rank = rank;

      if (rank < minRank) {
        return res.status(403).json({ error: "Forbidden" });
      }

      return next();
    } catch (e: any) {
      console.error("requireRank error:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  };
}

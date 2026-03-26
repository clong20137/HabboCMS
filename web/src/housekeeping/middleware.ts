import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { getPermissionsForRank, HKPermission } from "./permissions";
import type { RowDataPacket } from "mysql2/promise";

type RankRow = RowDataPacket & { rank: number; username: string };

export async function requireHousekeepingAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // requireAuth already set (req as any).user = { id, username }
    const baseUser = (req as any).user as
      | { id: number; username: string }
      | undefined;
    if (!baseUser?.id) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await pool.query<RankRow[]>(
      "SELECT username, `rank` FROM users WHERE id = ? LIMIT 1",
      [baseUser.id],
    );

    if (!rows.length) return res.status(401).json({ message: "Unauthorized" });

    const rank = Number(rows[0].rank ?? 0);
    const username = String(rows[0].username ?? baseUser.username);

    if (rank < 4)
      return res.status(403).json({ message: "Forbidden (rank too low)" });

    req.hkUser = { id: baseUser.id, username, rank };
    req.hkPerms = getPermissionsForRank(rank);

    return next();
  } catch (e) {
    console.error("HK ACCESS ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

export function requireHKPermission(permission: HKPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms = req.hkPerms;
    if (!perms || !perms.has(permission)) {
      return res
        .status(403)
        .json({ message: "Forbidden (missing permission)" });
    }
    return next();
  };
}

import { pool } from "../db";

export type BanResult = {
  banned: boolean;
  reason?: string;
  expiresAt?: string | null;
  bantype?: "account" | "ip" | "machine" | "super";
};

function parseExpireToIso(expire: any): string | null {
  const n = Number(expire);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function isActive(expire: any): boolean {
  const n = Number(expire);
  if (!Number.isFinite(n) || n <= 0) return true;
  return n > Math.floor(Date.now() / 1000);
}

export async function getBanStatus(opts: {
  userId?: number;
  username?: string;
  ip?: string;
  machine?: string;
}): Promise<BanResult> {
  try {
    const where: string[] = [];
    const params: any[] = [];

    if (opts.userId != null) {
      where.push("(type = 'account' AND user_id = ?)");
      params.push(opts.userId);
      where.push("(type = 'super' AND user_id = ?)");
      params.push(opts.userId);
    }

    if (opts.ip) {
      where.push("(type = 'ip' AND ip = ?)");
      params.push(opts.ip);
      where.push("(type = 'super' AND ip = ?)");
      params.push(opts.ip);
    }

    if (opts.machine) {
      where.push("(type = 'machine' AND machine_id = ?)");
      params.push(opts.machine);
      where.push("(type = 'super' AND machine_id = ?)");
      params.push(opts.machine);
    }

    if (!where.length) return { banned: false };

    const [rows] = await (pool as any).query(
      `
      SELECT type, ban_reason, ban_expire
      FROM bans
      WHERE ${where.join(" OR ")}
      ORDER BY id DESC
      LIMIT 25
      `,
      params,
    );

    for (const row of (rows as any[]) || []) {
      if (!isActive(row.ban_expire)) continue;

      return {
        banned: true,
        bantype: String(row.type) as any,
        reason: String(row.ban_reason || "You are banned."),
        expiresAt: parseExpireToIso(row.ban_expire),
      };
    }

    return { banned: false };
  } catch (err) {
    console.error("[ban] getBanStatus failed:", err);
    return { banned: false };
  }
}

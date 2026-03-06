import { pool } from "../db";

export type BanResult = {
  banned: boolean;
  reason?: string;
  expiresAt?: string | null; // ISO string or null for permanent
  bantype?: "user" | "ip" | "machine";
};

const TYPE_USER = "user";
const TYPE_IP = "ip";
const TYPE_MACHINE = "machine";

function parseExpireToIso(expire: any): string | null {
  if (expire == null) return null;

  // Your schema: expire is double, default 0 => permanent ban
  const n = Number(expire);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Stored as unix seconds
  const d = new Date(n * 1000);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function isStillActive(expiresAtIso: string | null): boolean {
  // null = permanent
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() > Date.now();
}

/**
 * Checks bans table:
 * - bantype: enum('user','ip','machine')
 * - value: varchar(50) (username or ip or machine id)
 * - expire: double (unix seconds). 0 => permanent
 */
export async function getBanStatus(opts: {
  userId?: number;
  username?: string;
  ip?: string;
  machine?: string;
}): Promise<BanResult> {
  try {
    const checks: Array<{ bantype: string; value: string }> = [];

    // Your earlier server log showed bantype='user' and value='Caleb'
    // So username-based bans are definitely used.
    if (opts.username)
      checks.push({ bantype: TYPE_USER, value: String(opts.username) });

    // Some systems also ban by userId in value; keep it as a fallback.
    if (opts.userId != null)
      checks.push({ bantype: TYPE_USER, value: String(opts.userId) });

    if (opts.ip) checks.push({ bantype: TYPE_IP, value: String(opts.ip) });

    // Optional: if you track machine fingerprint in your app/emulator
    if (opts.machine)
      checks.push({ bantype: TYPE_MACHINE, value: String(opts.machine) });

    if (!checks.length) return { banned: false };

    const where: string[] = [];
    const params: any[] = [];

    for (const c of checks) {
      where.push("(bantype = ? AND value = ?)");
      params.push(c.bantype, c.value);
    }

    const [rows] = await (pool as any).query(
      `
SELECT bantype, reason, expire
FROM bans
WHERE (${where.join(" OR ")})
ORDER BY id DESC
LIMIT 25
`,
      params,
    );

    for (const r of (rows as any[]) || []) {
      const expiresAt = parseExpireToIso(r.expire);
      if (!isStillActive(expiresAt)) continue;

      return {
        banned: true,
        bantype: String(r.bantype) as any,
        reason: r.reason || "You are banned.",
        expiresAt,
      };
    }

    return { banned: false };
  } catch (err) {
    // Fail-open so ban lookup can never take down login (no more 500s).
    console.error("[ban] getBanStatus failed:", err);
    return { banned: false };
  }
}

import type { Pool } from "mysql2/promise";

export type LoginHistoryRow = {
  id: number;
  createdAt: string;
  ip: string;
  userAgent: string | null;
  authMethod: "password" | "2fa";
  success: boolean;
};

function getClientIp(req: any): string {
  const xf = String(req.headers["x-forwarded-for"] || "").trim();
  if (xf) return xf.split(",")[0].trim();
  // express sets req.ip sometimes; fallback to socket
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

export async function recordLogin(opts: {
  pool: Pool;
  req: any;
  userId: number;
  authMethod: "password" | "2fa";
  success?: boolean;
}) {
  const { pool, req, userId, authMethod } = opts;
  const success = opts.success ?? true;

  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "").slice(0, 255) || null;

  await (pool as any).query(
    `INSERT INTO login_history (user_id, ip, user_agent, auth_method, success)
VALUES (?, ?, ?, ?, ?)`,
    [userId, ip, ua, authMethod, success ? 1 : 0],
  );
}

export async function getLoginHistory(
  pool: Pool,
  userId: number,
  limit = 20,
): Promise<LoginHistoryRow[]> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));

  const [rows] = (await (pool as any).query(
    `SELECT id, created_at, ip, user_agent, auth_method, success
FROM login_history
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ?`,
    [userId, safeLimit],
  )) as any;

  return (rows || []).map((r: any) => ({
    id: Number(r.id),
    createdAt: new Date(r.created_at).toISOString(),
    ip: String(r.ip || ""),
    userAgent: r.user_agent ? String(r.user_agent) : null,
    authMethod: (String(r.auth_method) as any) === "2fa" ? "2fa" : "password",
    success: Number(r.success) === 1,
  }));
}

import { Router } from "express";
import fs from "fs";
import path from "path";
import type {
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from "mysql2/promise";
import { pool } from "../db";
import { requireAuth } from "../auth";
import { requireHousekeepingAccess, requireHKPermission } from "./middleware";
import { hkAudit } from "./audit";
import { hasPermission } from "./permissions";
import { sanitizeRichHtml } from "../utils/html";

export const hkRouter = Router();

// must be logged in first
hkRouter.use(requireAuth);
// then must be rank >= 4
hkRouter.use(requireHousekeepingAccess);

// Who am I + permissions
hkRouter.get("/me", (req, res) => {
  return res.json({
    ok: true,
    user: req.hkUser,
    permissions: Array.from(req.hkPerms || []),
  });
});


type DashboardMetric = "registrations" | "credits" | "online_peak" | "shifts_worked";
type DashboardRange = "7d" | "30d" | "90d" | "1y";

function getDashboardDays(rangeRaw: any): number {
  const range = String(rangeRaw || "30d").toLowerCase();
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  if (range === "1y") return 365;
  return 30;
}

function getDashboardRange(rangeRaw: any): DashboardRange {
  const range = String(rangeRaw || "30d").toLowerCase();
  if (range === "7d" || range === "30d" || range === "90d" || range === "1y") return range;
  return "30d";
}

function getDashboardMetric(metricRaw: any): DashboardMetric {
  const metric = String(metricRaw || "registrations").toLowerCase();
  if (metric === "credits" || metric === "online_peak" || metric === "shifts_worked") return metric as DashboardMetric;
  return "registrations";
}

async function ensureDashboardSnapshotsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hk_dashboard_snapshots (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      online_count INT NOT NULL DEFAULT 0,
      total_credits BIGINT NOT NULL DEFAULT 0,
      total_users INT NOT NULL DEFAULT 0,
      total_shifts_worked BIGINT NOT NULL DEFAULT 0,
      KEY idx_captured_at (captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function captureDashboardSnapshotIfNeeded() {
  await ensureDashboardSnapshotsTable();

  const [lastRows] = await pool.query<RowDataPacket[]>(
    `SELECT UNIX_TIMESTAMP(captured_at) AS ts FROM hk_dashboard_snapshots ORDER BY id DESC LIMIT 1`,
  );

  const lastTs = lastRows.length ? Number((lastRows[0] as any).ts || 0) : 0;
  const nowTs = Math.floor(Date.now() / 1000);

  if (lastTs && nowTs - lastTs < 300) return;

  const [onlineRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM users WHERE online = 1`,
  );
  const currentOnline = Number((onlineRows[0] as any)?.cnt || 0);

  const [creditRows] = await pool.query<RowDataPacket[]>(`
    SELECT
      COALESCE((SELECT SUM(COALESCE(credits, 0)) FROM users), 0) +
      COALESCE((SELECT SUM(COALESCE(bank_credits, 0)) FROM user_stats), 0) AS totalCredits
  `);
  const totalCredits = Number((creditRows[0] as any)?.totalCredits || 0);

  const [userRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM users`);
  const totalUsers = Number((userRows[0] as any)?.cnt || 0);

  const [shiftRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(COALESCE(shifts_worked, 0)), 0) AS totalShifts FROM user_stats`,
  );
  const totalShiftsWorked = Number((shiftRows[0] as any)?.totalShifts || 0);

  await pool.query(
    `INSERT INTO hk_dashboard_snapshots (online_count, total_credits, total_users, total_shifts_worked) VALUES (?, ?, ?, ?)`,
    [currentOnline, totalCredits, totalUsers, totalShiftsWorked],
  );
}

function buildDenseDateSeries(days: number, map: Map<string, number>) {
  const out: Array<{ label: string; value: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    out.push({ label, value: Number(map.get(key) || 0) });
  }

  return out;
}

async function getDashboardSummary() {
  await captureDashboardSnapshotIfNeeded();

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM users) AS totalUsers,
      (SELECT COUNT(*) FROM users WHERE FROM_UNIXTIME(CAST(account_created AS UNSIGNED)) >= NOW() - INTERVAL 7 DAY) AS usersLast7Days,
      (SELECT COUNT(*) FROM users WHERE FROM_UNIXTIME(CAST(account_created AS UNSIGNED)) >= NOW() - INTERVAL 30 DAY) AS usersLast30Days,
      (SELECT COUNT(*) FROM users WHERE online = 1) AS currentOnlineUsers,
      (SELECT COALESCE(SUM(COALESCE(credits, 0)), 0) FROM users) + (SELECT COALESCE(SUM(COALESCE(bank_credits, 0)), 0) FROM user_stats) AS totalCredits,
      (SELECT COALESCE(MAX(online_count), 0) FROM hk_dashboard_snapshots) AS peakConcurrentUsers,
      (SELECT COALESCE(SUM(COALESCE(shifts_worked, 0)), 0) FROM user_stats) AS shiftsWorkedTotal
  `);

  let mostActiveHour = 0;
  try {
    const [hourRows] = await pool.query<RowDataPacket[]>(`
      SELECT HOUR(created_at) AS hourValue, COUNT(*) AS cnt
      FROM login_history
      WHERE created_at >= NOW() - INTERVAL 30 DAY
      GROUP BY HOUR(created_at)
      ORDER BY cnt DESC, hourValue ASC
      LIMIT 1
    `);
    if (hourRows.length) mostActiveHour = Number((hourRows[0] as any).hourValue || 0);
  } catch {}

  const row: any = rows[0] || {};
  return {
    totalUsers: Number(row.totalUsers || 0),
    usersLast7Days: Number(row.usersLast7Days || 0),
    usersLast30Days: Number(row.usersLast30Days || 0),
    totalCredits: Number(row.totalCredits || 0),
    peakConcurrentUsers: Number(row.peakConcurrentUsers || 0),
    currentOnlineUsers: Number(row.currentOnlineUsers || 0),
    mostActiveHour,
    shiftsWorkedTotal: Number(row.shiftsWorkedTotal || 0),
  };
}

async function getDashboardTrend(metric: DashboardMetric, range: DashboardRange) {
  const days = getDashboardDays(range);
  if (metric !== "registrations") await captureDashboardSnapshotIfNeeded();

  if (metric === "registrations") {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT DATE(FROM_UNIXTIME(CAST(account_created AS UNSIGNED))) AS d, COUNT(*) AS cnt
      FROM users
      WHERE FROM_UNIXTIME(CAST(account_created AS UNSIGNED)) >= NOW() - INTERVAL ? DAY
      GROUP BY DATE(FROM_UNIXTIME(CAST(account_created AS UNSIGNED)))
      ORDER BY d ASC
    `, [days]);

    const m = new Map<string, number>();
    for (const row of rows as any[]) {
      const key = String(row.d).slice(0, 10);
      m.set(key, Number(row.cnt || 0));
    }
    return buildDenseDateSeries(days, m);
  }

  const column = metric === "credits" ? "MAX(total_credits)" : metric === "online_peak" ? "MAX(online_count)" : "MAX(total_shifts_worked)";
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT DATE(captured_at) AS d, ${column} AS value
    FROM hk_dashboard_snapshots
    WHERE captured_at >= NOW() - INTERVAL ? DAY
    GROUP BY DATE(captured_at)
    ORDER BY d ASC
  `, [days]);

  const m = new Map<string, number>();
  for (const row of rows as any[]) {
    const key = String(row.d).slice(0, 10);
    m.set(key, Number(row.value || 0));
  }
  return buildDenseDateSeries(days, m);
}

async function getDashboardActivity(range: DashboardRange) {
  const days = getDashboardDays(range);
  let rows: RowDataPacket[] = [];

  try {
    const [loginRows] = await pool.query<RowDataPacket[]>(`
      SELECT HOUR(created_at) AS h, COUNT(*) AS cnt
      FROM login_history
      WHERE created_at >= NOW() - INTERVAL ? DAY
      GROUP BY HOUR(created_at)
      ORDER BY h ASC
    `, [days]);
    rows = loginRows;
  } catch {
    await captureDashboardSnapshotIfNeeded();
    const [snapshotRows] = await pool.query<RowDataPacket[]>(`
      SELECT HOUR(captured_at) AS h, AVG(online_count) AS cnt
      FROM hk_dashboard_snapshots
      WHERE captured_at >= NOW() - INTERVAL ? DAY
      GROUP BY HOUR(captured_at)
      ORDER BY h ASC
    `, [days]);
    rows = snapshotRows;
  }

  const map = new Map<number, number>();
  for (const row of rows as any[]) map.set(Number(row.h || 0), Number(row.cnt || 0));

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: (() => { const suffix = hour >= 12 ? "PM" : "AM"; const normalized = hour % 12 || 12; return `${normalized}${suffix}`; })(),
    value: Number(map.get(hour) || 0),
  }));
}

hkRouter.get("/dashboard", async (_req, res) => {
  try {
    const summary = await getDashboardSummary();
    return res.json({ ok: true, summary });
  } catch (e: any) {
    console.error("HK DASHBOARD SUMMARY ERROR:", e);
    return res.status(500).json({ error: e?.message || "Failed to load dashboard." });
  }
});

hkRouter.get("/dashboard/trends", async (req, res) => {
  try {
    const metric = getDashboardMetric(req.query.metric);
    const range = getDashboardRange(req.query.range);
    const points = await getDashboardTrend(metric, range);
    return res.json({ ok: true, metric, range, points });
  } catch (e: any) {
    console.error("HK DASHBOARD TRENDS ERROR:", e);
    return res.status(500).json({ error: e?.message || "Failed to load dashboard trends." });
  }
});

hkRouter.get("/dashboard/activity", async (req, res) => {
  try {
    const range = getDashboardRange(req.query.range);
    const hourly = await getDashboardActivity(range);
    return res.json({ ok: true, range, hourly });
  } catch (e: any) {
    console.error("HK DASHBOARD ACTIVITY ERROR:", e);
    return res.status(500).json({ error: e?.message || "Failed to load dashboard activity." });
  }
});

/* =========================
BANS (HOUSEKEEPING ADMIN)
Table: bans
- id (int)
- user_id int
- ip varchar(50)
- machine_id varchar(255)
- user_staff_id int
- timestamp int
- ban_expire int (unix seconds). 0 = permanent
- ban_reason varchar(200)
- type enum('account','ip','machine','super')
- cfh_topic int
========================= */

type BanRow = RowDataPacket & {
  id: number;
  type: "account" | "ip" | "machine" | "super";
  user_id: number | null;
  ip: string | null;
  machine_id: string | null;
  user_staff_id: number | null;
  ban_reason: string;
  ban_expire: any;
  timestamp: any;
  cfh_topic: number | null;
};

const BAN_TYPES = new Set(["account", "ip", "machine", "super"]);

function toUnixSecondsNow() {
  return Math.floor(Date.now() / 1000);
}

function numOr0(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// LIST
// GET /api/hk/bans?q=caleb&bantype=account&active=1&limit=50&offset=0
hkRouter.get("/bans", requireHKPermission("hk.bans.view"), async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const bantype = String(req.query.bantype ?? "")
      .trim()
      .toLowerCase();
    const active = String(req.query.active ?? "").trim(); // "1" to only show active
    const limitRaw = Number(req.query.limit ?? 50);
    const offsetRaw = Number(req.query.offset ?? 0);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;

    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const wheres: string[] = [];
    const params: any[] = [];

    if (bantype) {
      if (!BAN_TYPES.has(bantype)) {
        return res.status(400).json({ error: "Invalid bantype." });
      }
      wheres.push("type = ?");
      params.push(bantype);
    }

    if (q) {
      wheres.push("(CAST(user_id AS CHAR) LIKE ? OR ip LIKE ? OR machine_id LIKE ? OR ban_reason LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (active === "1") {
      wheres.push("(ban_expire = 0 OR ban_expire > ?)");
      params.push(toUnixSecondsNow());
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";

    const [rows] = await pool.query<BanRow[]>(
      `
SELECT id, type, user_id, ip, machine_id, user_staff_id, timestamp, ban_expire, ban_reason, cfh_topic
FROM bans
${whereSql}
ORDER BY id DESC
LIMIT ?
OFFSET ?
`,
      [...params, limit, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `
SELECT COUNT(*) AS cnt
FROM bans
${whereSql}
`,
      params,
    );

    const total = countRows.length ? Number((countRows[0] as any).cnt ?? 0) : 0;

    return res.json({
      ok: true,
      total,
      items: (rows as any[]).map((r) => ({
        id: Number(r.id),
        bantype: String(r.type),
        user_id: r.user_id == null ? null : Number(r.user_id),
        ip: r.ip == null ? null : String(r.ip),
        machine_id: r.machine_id == null ? null : String(r.machine_id),
        user_staff_id: r.user_staff_id == null ? null : Number(r.user_staff_id),
        reason: String(r.ban_reason ?? ""),
        expire: numOr0(r.ban_expire),
        added_date: numOr0(r.timestamp),
        cfh_topic: r.cfh_topic == null ? null : Number(r.cfh_topic),
      })),
    });
  } catch (e: any) {
    console.error("HK BANS LIST ERROR:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// CREATE
// POST /api/hk/bans { bantype, user_id?, ip?, machine_id?, reason, permanent?:true, durationSeconds?:3600 }
hkRouter.post(
  "/bans",
  requireHKPermission("hk.bans.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const bantype = String(req.body?.bantype ?? "")
        .trim()
        .toLowerCase();
      const userId = req.body?.user_id == null ? null : Number(req.body?.user_id);
      const ip = req.body?.ip == null ? null : String(req.body?.ip).trim();
      const machineId = req.body?.machine_id == null ? null : String(req.body?.machine_id).trim();
      const reason = String(req.body?.reason ?? "").trim();

      const permanent = Boolean(req.body?.permanent);
      const durationSeconds = Number(req.body?.durationSeconds ?? 0);

      if (!BAN_TYPES.has(bantype)) {
        return res.status(400).json({ error: "Invalid bantype." });
      }
      if (bantype === "account" && !userId) {
        return res.status(400).json({ error: "user_id is required for account bans." });
      }
      if (bantype === "ip" && !ip) {
        return res.status(400).json({ error: "ip is required for ip bans." });
      }
      if (bantype === "machine" && !machineId) {
        return res.status(400).json({ error: "machine_id is required for machine bans." });
      }
      if (bantype === "super" && !userId && !ip && !machineId) {
        return res.status(400).json({ error: "Provide at least one target for a super ban." });
      }
      if (!reason || reason.length > 2000) {
        return res
          .status(400)
          .json({ error: "Reason is required (max 2000)." });
      }

      const now = toUnixSecondsNow();

      let expire = 0;
      if (permanent) {
        expire = 0;
      } else {
        if (!Number.isFinite(durationSeconds) || durationSeconds < 60) {
          return res.status(400).json({
            error:
              "durationSeconds is required (min 60) unless permanent=true.",
          });
        }
        // expire is unix seconds
        expire = now + Math.floor(durationSeconds);
      }

      const [result] = await pool.query<ResultSetHeader>(
        `
INSERT INTO bans (user_id, ip, machine_id, user_staff_id, timestamp, ban_expire, ban_reason, type, cfh_topic)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, -1)
`,
        [userId, ip, machineId, actor.id, now, expire, reason, bantype],
      );

      const id = Number(result.insertId || 0);

      await hkAudit(req, {
        action: "bans.create",
        targetType: "ban",
        targetId: id || userId || ip || machineId || bantype,
        details: { bantype, userId, ip, machineId, expire, permanent: expire === 0 },
      });

      return res.json({ ok: true, id });
    } catch (e: any) {
      console.error("HK BANS CREATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// UPDATE
// PUT /api/hk/bans/:id { reason?, permanent?, durationSeconds?, appeal_state? }
hkRouter.put(
  "/bans/:id",
  requireHKPermission("hk.bans.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid ban id." });
      }

      const reasonIn = req.body?.reason;
      const reason = typeof reasonIn === "string" ? reasonIn.trim() : undefined;

      const permanent =
        req.body?.permanent === undefined
          ? undefined
          : Boolean(req.body?.permanent);

      const durationSecondsRaw = req.body?.durationSeconds;
      const durationSeconds =
        durationSecondsRaw === undefined
          ? undefined
          : Number(durationSecondsRaw);

      const [existingRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, type, user_id, ip, machine_id, ban_expire FROM bans WHERE id = ? LIMIT 1",
        [id],
      );
      if (!existingRows.length) {
        return res.status(404).json({ error: "Ban not found." });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (reason !== undefined) {
        if (!reason || reason.length > 2000) {
          return res
            .status(400)
            .json({ error: "Reason is required (max 2000)." });
        }
        updates.push("ban_reason = ?");
        params.push(reason);
      }

      // Expiry logic
      if (permanent === true) {
        updates.push("ban_expire = 0");
      } else if (durationSeconds !== undefined) {
        if (!Number.isFinite(durationSeconds) || durationSeconds < 60) {
          return res
            .status(400)
            .json({ error: "durationSeconds must be >= 60." });
        }
        const now = toUnixSecondsNow();
        updates.push("ban_expire = ?");
        params.push(now + Math.floor(durationSeconds));
      }

      if (!updates.length) {
        return res.status(400).json({ error: "No fields to update." });
      }

      params.push(id);

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE bans SET ${updates.join(", ")} WHERE id = ? LIMIT 1`,
        params,
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: "Ban not found." });
      }

      await hkAudit(req, {
        action: "bans.update",
        targetType: "ban",
        targetId: id,
        details: { by: actor.username },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK BANS UPDATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// DELETE
// DELETE /api/hk/bans/:id
hkRouter.delete(
  "/bans/:id",
  requireHKPermission("hk.bans.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid ban id." });
      }

      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM bans WHERE id = ? LIMIT 1",
        [id],
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: "Ban not found." });
      }

      await hkAudit(req, {
        action: "bans.delete",
        targetType: "ban",
        targetId: id,
        details: { by: actor.username },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK BANS DELETE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

/* =========================
NEWS (create/edit/delete)
- id
- title
- description
- story
- image_url
- author
- created_at
- story_html (NOT NULL)
========================= */

type NewsRow = RowDataPacket & {
  id: number;
  title: string;
  description: string;
  story: string | null;
  story_html: string; // NOT NULL in DB
  image_url: string | null;
  author: string;
  created_at: any;
};

function pickStr(body: any, keys: string[], fallback = "") {
  for (const k of keys) {
    const v = body?.[k];
    if (typeof v === "string") return v;
  }
  return fallback;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// if user gives plain story, create a minimal HTML wrapper
function storyToHtml(story: string) {
  const t = String(story ?? "").trim();
  if (!t) return "<p></p>";
  // convert line breaks to paragraphs
  const parts = t.split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br/>"));
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

// store only filename if client sends "/assets/news/file.png"
function normalizeImageUrl(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const noQs = raw.split("?")[0];

  if (/^https?:\/\//i.test(noQs)) return noQs;

  const cleaned = noQs.replace(/^\/?public\//i, "/");

  const m = cleaned.match(/\/assets\/news\/([^/]+)$/i);
  if (m?.[1]) return m[1];

  const winFile = cleaned.split("\\").pop();
  if (winFile && /\.(png|jpe?g|gif|webp)$/i.test(winFile)) return winFile;

  return cleaned;
}

// return proper public URL regardless of stored value
function toPublicImageUrl(stored: any) {
  const raw = String(stored ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return `/assets/news/${raw}`;
}

// ✅ IMPORTANT: Put /news/images BEFORE /news/:id
hkRouter.get(
  "/news/images",
  requireHKPermission("hk.news.edit"),
  async (_req, res) => {
    try {
      const baseDir =
        process.env.HK_NEWS_ASSETS_DIR ||
        path.join(process.cwd(), "public", "assets", "news");

      if (!fs.existsSync(baseDir)) return res.json({ ok: true, items: [] });

      const allowed = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
      const files = fs
        .readdirSync(baseDir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => allowed.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

      return res.json({
        ok: true,
        items: files.map((f) => ({ name: f, url: `/assets/news/${f}` })),
      });
    } catch (e: any) {
      console.error("HK NEWS IMAGES ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// LIST
hkRouter.get("/news", requireHKPermission("hk.news.view"), async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const limitRaw = Number(req.query.limit ?? 50);
    const offsetRaw = Number(req.query.offset ?? 0);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;

    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const where = search
      ? "WHERE title LIKE ? OR description LIKE ? OR story LIKE ? OR author LIKE ?"
      : "";

    const params = search
      ? [
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          limit,
          offset,
        ]
      : [limit, offset];

    const [rows] = await pool.query<NewsRow[]>(
      `
SELECT id, title, description, story, story_html, image_url, author, created_at
FROM news
${where}
ORDER BY id DESC
LIMIT ?
OFFSET ?
`,
      params as any,
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `
SELECT COUNT(*) AS cnt
FROM news
${
  search
    ? "WHERE title LIKE ? OR description LIKE ? OR story LIKE ? OR author LIKE ?"
    : ""
}
`,
      search
        ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
        : [],
    );

    const total = countRows.length ? Number((countRows[0] as any).cnt ?? 0) : 0;

    return res.json({
      ok: true,
      total,
      items: rows.map((r: any) => ({
        id: Number(r.id),
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        story: r.story == null ? "" : String(r.story),
        storyHtml: String(r.story_html ?? "<p></p>"),
        imageUrl: toPublicImageUrl(r.image_url),
        author: String(r.author ?? ""),
        createdAt: String(r.created_at ?? ""),
      })),
    });
  } catch (e: any) {
    console.error("HK NEWS LIST ERROR:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// GET SINGLE
hkRouter.get(
  "/news/:id",
  requireHKPermission("hk.news.view"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const [rows] = await pool.query<NewsRow[]>(
        `
SELECT id, title, description, story, story_html, image_url, author, created_at
FROM news
WHERE id = ?
LIMIT 1
`,
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ error: "News article not found." });
      }

      const r: any = rows[0];

      return res.json({
        ok: true,
        item: {
          id: Number(r.id),
          title: String(r.title ?? ""),
          description: String(r.description ?? ""),
          story: r.story == null ? "" : String(r.story),
          storyHtml: String(r.story_html ?? "<p></p>"),
          imageUrl: toPublicImageUrl(r.image_url),
          author: String(r.author ?? ""),
          createdAt: String(r.created_at ?? ""),
        },
      });
    } catch (e: any) {
      console.error("HK NEWS GET ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// CREATE
hkRouter.post(
  "/news",
  requireHKPermission("hk.news.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;

      const title = pickStr(req.body, ["title"], "").trim();
      const description = pickStr(req.body, ["description", "desc"], "").trim();

      // accept multiple names
      const story = pickStr(req.body, ["story", "body"], "").trim();
      let storyHtml = pickStr(
        req.body,
        ["storyHtml", "story_html", "html"],
        "",
      ).trim();

      const imageIncoming = pickStr(
        req.body,
        ["imageUrl", "image_url", "image"],
        "",
      ).trim();
      const imageStored = normalizeImageUrl(imageIncoming);

      if (!title || title.length > 120) {
        return res
          .status(400)
          .json({ error: "Title is required (max 120 characters)." });
      }

      if (description.length > 255) {
        return res
          .status(400)
          .json({ error: "Description max length is 255 characters." });
      }

      // ✅ ENSURE story_html is NEVER NULL
      if (!storyHtml) {
        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(story);
        storyHtml = looksLikeHtml ? story : storyToHtml(story);
      }

      if (!story && !storyHtml) {
        return res.status(400).json({ error: "Story is required." });
      }

      storyHtml = sanitizeRichHtml(storyHtml);

      const [result] = await pool.query<ResultSetHeader>(
        `
INSERT INTO news (title, description, story, story_html, image_url, author)
VALUES (?, ?, ?, ?, ?, ?)
`,
        [
          title,
          description,
          story || null,
          storyHtml || "<p></p>",
          imageStored || null,
          actor.username,
        ],
      );

      const id = Number(result.insertId);

      await hkAudit(req, {
        action: "news.create",
        targetType: "news",
        targetId: id,
        details: { title, imageUrl: imageStored || null },
      });

      return res.json({ ok: true, id });
    } catch (e: any) {
      console.error("HK NEWS CREATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// UPDATE
hkRouter.put(
  "/news/:id",
  requireHKPermission("hk.news.edit"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const title = pickStr(req.body, ["title"], "").trim();
      const description = pickStr(req.body, ["description", "desc"], "").trim();

      const story = pickStr(req.body, ["story", "body"], "").trim();
      let storyHtml = pickStr(
        req.body,
        ["storyHtml", "story_html", "html"],
        "",
      ).trim();

      const imageIncoming = pickStr(
        req.body,
        ["imageUrl", "image_url", "image"],
        "",
      ).trim();
      const imageStored = normalizeImageUrl(imageIncoming);

      if (!title || title.length > 120) {
        return res
          .status(400)
          .json({ error: "Title is required (max 120 characters)." });
      }

      if (description.length > 255) {
        return res
          .status(400)
          .json({ error: "Description max length is 255 characters." });
      }

      // ✅ ENSURE story_html is NEVER NULL
      if (!storyHtml) {
        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(story);
        storyHtml = looksLikeHtml ? story : storyToHtml(story);
      }

      if (!story && !storyHtml) {
        return res.status(400).json({ error: "Story is required." });
      }

      storyHtml = sanitizeRichHtml(storyHtml);

      const [result] = await pool.query<ResultSetHeader>(
        `
UPDATE news
SET title = ?, description = ?, story = ?, story_html = ?, image_url = ?
WHERE id = ?
LIMIT 1
`,
        [
          title,
          description,
          story || null,
          storyHtml || "<p></p>",
          imageStored || null,
          id,
        ],
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: "News article not found." });
      }

      await hkAudit(req, {
        action: "news.update",
        targetType: "news",
        targetId: id,
        details: { title, imageUrl: imageStored || null },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK NEWS UPDATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// DELETE
hkRouter.delete(
  "/news/:id",
  requireHKPermission("hk.news.edit"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM news WHERE id = ? LIMIT 1",
        [id],
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: "News article not found." });
      }

      await hkAudit(req, {
        action: "news.delete",
        targetType: "news",
        targetId: id,
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK NEWS DELETE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

/* =========================
SERVER SETTINGS (Table: server_settings)
- key (varchar 255, PK)
- value (text)
- description (text)
Rank 7 only
========================= */
type ServerSettingRow = RowDataPacket & {
key: string;
value: string;
};

hkRouter.get(
"/server-settings",
requireHKPermission("hk.server_settings.edit"),
async (_req, res) => {
try {
const [rows] = await pool.query<ServerSettingRow[]>(
`
SELECT \`key\`, \`value\`
FROM emulator_settings
ORDER BY \`key\` ASC
`,
);

return res.json({
ok: true,
items: rows.map((r) => ({
key: String(r.key),
value: String(r.value ?? ""),
description: "",
})),
});
} catch (e) {
console.error("HK SERVER SETTINGS LIST ERROR:", e);
return res.status(500).json({ error: "Server error" });
}
},
);

hkRouter.put(
"/server-settings/:key",
requireHKPermission("hk.server_settings.edit"),
async (req, res) => {
try {
const key = String(req.params.key ?? "").trim();
const value = String(req.body?.value ?? "");

if (!key) {
return res.status(400).json({ error: "Key is required." });
}

if (key.length > 100) {
return res.status(400).json({ error: "Key is too long." });
}

if (value.length > 512) {
return res.status(400).json({ error: "Value is too long." });
}

const [exists] = await pool.query<RowDataPacket[]>(
"SELECT `key` FROM emulator_settings WHERE `key` = ? LIMIT 1",
[key],
);

if (!exists.length) {
return res.status(404).json({ error: "Setting not found." });
}

await pool.query(
"UPDATE emulator_settings SET `value` = ? WHERE `key` = ? LIMIT 1",
[value, key],
);

return res.json({ ok: true });
} catch (e) {
console.error("HK SERVER SETTINGS UPDATE ERROR:", e);
return res.status(500).json({ error: "Server error" });
}
},
);


/* =========================
USERS (view/edit)
========================= */

// ❌ NEVER editable
const HK_USER_FORBIDDEN_FIELDS = new Set([
  "password",
  "auth_ticket",
  "ip_last",
  "ip_reg",
  "machine_id",
  "totp_secret",
  "totp_backup_codes",
]);

// ✅ Editable (everything safe)
const HK_USER_EDITABLE_FIELDS = new Set([
  "mail",
  "rank",
  "rank_vip",
  "credits",
  "vip_points",
  "activity_points",
  "look",
  "gender",
  "motto",
  "account_created",
  "last_online",
  "online",
  "home_room",
  "is_muted",
  "block_newfriends",
  "hide_online",
  "hide_inroom",
  "vip",
  "volume",
  "last_change",
  "focus_preference",
  "chat_preference",
  "pets_muted",
  "bots_muted",
  "advertising_report_blocked",
  "gotw_points",
  "ignore_invites",
  "time_muted",
  "allow_gifts",
  "trading_locked",
  "friend_bar_state",
  "disable_forced_effects",
  "allow_mimic",
  "is_ambassador",
  "bubble_id",
  "kills",
  "deaths",
  "punches_thrown",
  "punches_received",
  "arrests_made",
  "arrests_amount",
  "damage_dealt",
  "damage_received",
  "kd",
  "bank_amount",
  "health",
  "max_health",
  "energy",
  "max_energy",
  "totp_enabled",
]);

function maskIp(ip: any) {
  const s = String(ip ?? "").trim();
  if (!s) return "";
  const first = s.includes(".") ? s.split(".")[0] : s.split(":")[0];
  return `${first}***`;
}

// GET USERS
hkRouter.get(
  "/users",
  requireHKPermission("hk.user.view"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const q = String(req.query.q || "").trim();
      const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);

      const baseSql = `
SELECT *
FROM users
${q ? "WHERE username LIKE ? OR mail LIKE ?" : ""}
ORDER BY id DESC
LIMIT ?
`;

      const params = q ? [`%${q}%`, `%${q}%`, limit] : [limit];

      const [rows] = await pool.query<RowDataPacket[]>(baseSql, params);

      const canSeeIp = actor.rank >= 7;

      const items = (rows as any[]).map((r) => {
        const row: any = { ...r };

        // 🔒 Mask IP if rank <= 6
        if (!canSeeIp) {
          row.ip_last = maskIp(row.ip_last);
          row.ip_reg = maskIp(row.ip_reg);
        }

        // ❌ Never send secrets
        delete row.password;
        delete row.auth_ticket;
        delete row.machine_id;
        delete row.totp_secret;
        delete row.totp_backup_codes;

        return row;
      });

      return res.json({ ok: true, items });
    } catch (e: any) {
      console.error("HK USERS LIST ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// PATCH USER
hkRouter.patch(
  "/users/:id",
  requireHKPermission("hk.user.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const targetId = Number(req.params.id);

      if (!Number.isFinite(targetId) || targetId <= 0)
        return res.status(400).json({ error: "Invalid user id" });

      const [targetRows] = await pool.query<RowDataPacket[]>(
        "SELECT id, `rank` FROM users WHERE id = ? LIMIT 1",
        [targetId],
      );

      if (!targetRows.length)
        return res.status(404).json({ error: "User not found" });

      const target = targetRows[0] as any;

      // 🔒 Cannot edit equal/higher rank
      if (Number(target.rank) >= actor.rank)
        return res.status(403).json({
          error: "You cannot edit a user with equal/higher rank.",
        });

      const body = req.body || {};
      const keys = Object.keys(body);

      if (!keys.length)
        return res.status(400).json({ error: "No changes provided" });

      const updates: string[] = [];
      const params: any[] = [];

      for (const k of keys) {
        if (HK_USER_FORBIDDEN_FIELDS.has(k)) {
          return res.status(400).json({
            error: `Field not editable: ${k}`,
          });
        }

        if (!HK_USER_EDITABLE_FIELDS.has(k)) {
          return res.status(400).json({
            error: `Field not editable: ${k}`,
          });
        }

        if (k === "rank") {
          const newRank = Number(body.rank);
          if (!Number.isFinite(newRank) || newRank < 1 || newRank > 7)
            return res.status(400).json({ error: "Invalid rank" });

          if (newRank >= actor.rank)
            return res.status(403).json({
              error: "You cannot set rank >= your own rank.",
            });

          updates.push("`rank` = ?");
          params.push(newRank);
          continue;
        }

        updates.push(`\`${k}\` = ?`);
        params.push(body[k]);
      }

      if (!updates.length)
        return res.status(400).json({ error: "No valid changes provided" });

      params.push(targetId);

      await pool.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ? LIMIT 1`,
        params,
      );

      await hkAudit(req, {
        action: "user.update",
        targetType: "user",
        targetId,
        details: { updates: body },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK USERS PATCH ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

/* =========================
WORD FILTER
========================= */

type WordFilterRow = RowDataPacket & {
  word: string;
  replacement: string;
  strict: "0" | "1";
  addedby: string;
  bannable: "0" | "1";
};

hkRouter.get(
  "/wordfilter",
  requireHKPermission("hk.wordfilter.view"),
  async (req, res) => {
    try {
      const search = String(req.query.search ?? "").trim();
      const limitRaw = Number(req.query.limit ?? 50);
      const offsetRaw = Number(req.query.offset ?? 0);

      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 200)
        : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const where = search
        ? "WHERE word LIKE ? OR replacement LIKE ? OR addedby LIKE ?"
        : "";

      const params = search
        ? [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
        : [limit, offset];

      const [rows] = await pool.query<WordFilterRow[]>(
        `
SELECT word, replacement, strict, addedby, bannable
FROM wordfilter
${where}
ORDER BY word ASC
LIMIT ?
OFFSET ?
`,
        params as any,
      );

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM wordfilter ${
          search
            ? "WHERE word LIKE ? OR replacement LIKE ? OR addedby LIKE ?"
            : ""
        }`,
        search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [],
      );

      const total = countRows.length
        ? Number((countRows[0] as any).cnt ?? 0)
        : 0;

      return res.json({
        ok: true,
        total,
        items: rows.map((r) => ({
          word: String(r.word),
          replacement: String(r.replacement ?? ""),
          strict: String(r.strict ?? "1") === "1",
          bannable: String(r.bannable ?? "0") === "1",
          addedby: String(r.addedby ?? ""),
        })),
      });
    } catch (e: any) {
      console.error("HK WORDFILTER LIST ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

hkRouter.post(
  "/wordfilter",
  requireHKPermission("hk.wordfilter.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const word = String(req.body?.word ?? "").trim();
      const replacement = String(req.body?.replacement ?? "").trim();
      const bannable = Boolean(req.body?.bannable);
      const strict =
        req.body?.strict === undefined ? true : Boolean(req.body?.strict);

      if (word.length < 1 || word.length > 100) {
        return res
          .status(400)
          .json({ error: "Word must be 1-100 characters." });
      }
      if (replacement.length > 255) {
        return res
          .status(400)
          .json({ error: "Replacement max length is 255." });
      }

      await pool.query<ResultSetHeader>(
        `
INSERT INTO wordfilter (word, replacement, strict, addedby, bannable)
VALUES (?, ?, ?, ?, ?)
`,
        [
          word,
          replacement,
          strict ? "1" : "0",
          actor.username,
          bannable ? "1" : "0",
        ],
      );

      await hkAudit(req, {
        action: "wordfilter.create",
        targetType: "wordfilter",
        targetId: word, // pk is word
        details: { word, replacement, strict, bannable },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      if (String(e?.code) === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "That word already exists." });
      }
      console.error("HK WORDFILTER CREATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

hkRouter.put(
  "/wordfilter/:word",
  requireHKPermission("hk.wordfilter.edit"),
  async (req, res) => {
    try {
      const oldWord = String(req.params.word ?? "").trim();
      if (!oldWord) return res.status(400).json({ error: "Invalid word." });

      const newWord = String(req.body?.newWord ?? "").trim();
      const replacement = String(req.body?.replacement ?? "").trim();
      const bannable = Boolean(req.body?.bannable);
      const strict =
        req.body?.strict === undefined ? true : Boolean(req.body?.strict);

      if (replacement.length > 255) {
        return res
          .status(400)
          .json({ error: "Replacement max length is 255." });
      }
      if (newWord && (newWord.length < 1 || newWord.length > 100)) {
        return res
          .status(400)
          .json({ error: "New word must be 1-100 characters." });
      }

      if (newWord && newWord !== oldWord) {
        // rename pk
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          const [rows] = await conn.query<RowDataPacket[]>(
            "SELECT addedby FROM wordfilter WHERE word = ? LIMIT 1",
            [oldWord],
          );

          if (!rows.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ error: "Word not found." });
          }

          const addedby = String((rows[0] as any).addedby ?? "");

          await conn.query(
            `
INSERT INTO wordfilter (word, replacement, strict, addedby, bannable)
VALUES (?, ?, ?, ?, ?)
`,
            [
              newWord,
              replacement,
              strict ? "1" : "0",
              addedby,
              bannable ? "1" : "0",
            ],
          );

          await conn.query("DELETE FROM wordfilter WHERE word = ? LIMIT 1", [
            oldWord,
          ]);

          await conn.commit();
          conn.release();
        } catch (err: any) {
          try {
            await conn.rollback();
          } catch {}
          conn.release();

          if (String(err?.code) === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "New word already exists." });
          }
          throw err;
        }

        return res.json({ ok: true, renamed: true });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `
UPDATE wordfilter
SET replacement = ?, strict = ?, bannable = ?
WHERE word = ?
LIMIT 1
`,
        [replacement, strict ? "1" : "0", bannable ? "1" : "0", oldWord],
      );

      if (!result.affectedRows)
        return res.status(404).json({ error: "Word not found." });

      await hkAudit(req, {
        action: "wordfilter.update",
        targetType: "wordfilter",
        targetId: oldWord,
        details: { replacement, strict, bannable, newWord: newWord || null },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK WORDFILTER UPDATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

hkRouter.delete(
  "/wordfilter/:word",
  requireHKPermission("hk.wordfilter.edit"),
  async (req, res) => {
    try {
      const word = String(req.params.word ?? "").trim();
      if (!word) return res.status(400).json({ error: "Invalid word." });

      const [result] = await pool.query<ResultSetHeader>(
        "DELETE FROM wordfilter WHERE word = ? LIMIT 1",
        [word],
      );

      if (!result.affectedRows)
        return res.status(404).json({ error: "Word not found." });

      await hkAudit(req, {
        action: "wordfilter.delete",
        targetType: "wordfilter",
        targetId: word,
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK WORDFILTER DELETE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

/* =========================
SUPPORT TICKETS (HOUSEKEEPING ADMIN)
========================= */

const ALLOWED_TICKET_STATUS = new Set(["open", "pending", "closed"]);

type HKTicketRow = RowDataPacket & {
  id: number;
  user_id: number;
  username: string;
  type: string;
  status: "open" | "pending" | "closed";
  created_at: any;
  updated_at: any;
};

type HKTicketMsgRow = RowDataPacket & {
  id: number;
  ticket_id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: any;
};

// LIST ALL TICKETS
hkRouter.get(
  "/tickets",
  requireHKPermission("hk.tickets.view"),
  async (req, res) => {
    try {
      const status = String(req.query.status ?? "")
        .trim()
        .toLowerCase();
      const type = String(req.query.type ?? "").trim();
      const q = String(req.query.q ?? "").trim();

      const limitRaw = Number(req.query.limit ?? 50);
      const offsetRaw = Number(req.query.offset ?? 0);

      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 200)
        : 50;

      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const wheres: string[] = [];
      const params: any[] = [];

      if (status) {
        if (!ALLOWED_TICKET_STATUS.has(status)) {
          return res.status(400).json({ error: "Invalid status filter." });
        }
        wheres.push("t.status = ?");
        params.push(status);
      }

      if (type) {
        wheres.push("t.type = ?");
        params.push(type);
      }

      if (q) {
        wheres.push(
          `(u.username LIKE ? OR CAST(t.id AS CHAR) LIKE ? OR EXISTS (
SELECT 1 FROM support_ticket_messages m
WHERE m.ticket_id = t.id AND m.message LIKE ?
))`,
        );
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }

      const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";

      const [rows] = await pool.query<HKTicketRow[]>(
        `
SELECT
t.id,
t.user_id,
u.username,
t.type,
t.status,
t.created_at,
t.updated_at
FROM support_tickets t
JOIN users u ON u.id = t.user_id
${whereSql}
ORDER BY t.updated_at DESC, t.id DESC
LIMIT ?
OFFSET ?
`,
        [...params, limit, offset],
      );

      const [countRows] = await pool.query<RowDataPacket[]>(
        `
SELECT COUNT(*) AS cnt
FROM support_tickets t
JOIN users u ON u.id = t.user_id
${whereSql}
`,
        params,
      );

      const total = countRows.length
        ? Number((countRows[0] as any).cnt ?? 0)
        : 0;

      return res.json({
        ok: true,
        total,
        items: rows.map((t) => ({
          id: Number(t.id),
          userId: Number(t.user_id),
          username: String(t.username),
          type: String(t.type),
          status: String(t.status),
          createdAt: String(t.created_at),
          updatedAt: String(t.updated_at),
        })),
      });
    } catch (e: any) {
      console.error("HK TICKETS LIST ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// READ ONE TICKET + MESSAGES
hkRouter.get(
  "/tickets/:id",
  requireHKPermission("hk.tickets.view"),
  async (req, res) => {
    try {
      const ticketId = Number(req.params.id);
      if (!Number.isFinite(ticketId) || ticketId <= 0) {
        return res.status(400).json({ error: "Invalid ticket id." });
      }

      const [tRows] = await pool.query<HKTicketRow[]>(
        `
SELECT
t.id,
t.user_id,
u.username,
t.type,
t.status,
t.created_at,
t.updated_at
FROM support_tickets t
JOIN users u ON u.id = t.user_id
WHERE t.id = ?
LIMIT 1
`,
        [ticketId],
      );

      if (!tRows.length)
        return res.status(404).json({ error: "Ticket not found." });

      const [mRows] = await pool.query<HKTicketMsgRow[]>(
        `
SELECT
m.id,
m.ticket_id,
m.user_id,
u.username,
m.message,
m.created_at
FROM support_ticket_messages m
JOIN users u ON u.id = m.user_id
WHERE m.ticket_id = ?
ORDER BY m.created_at ASC
`,
        [ticketId],
      );

      const t = tRows[0];

      return res.json({
        ok: true,
        ticket: {
          id: Number(t.id),
          userId: Number(t.user_id),
          username: String(t.username),
          type: String(t.type),
          status: String(t.status),
          createdAt: String(t.created_at),
          updatedAt: String(t.updated_at),
        },
        messages: mRows.map((m) => ({
          id: Number(m.id),
          ticketId: Number(m.ticket_id),
          userId: Number(m.user_id),
          username: String(m.username),
          message: String(m.message),
          createdAt: String(m.created_at),
        })),
      });
    } catch (e: any) {
      console.error("HK TICKET READ ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// REPLY TO A TICKET
hkRouter.post(
  "/tickets/:id/reply",
  requireHKPermission("hk.tickets.edit"),
  async (req, res) => {
    let conn: PoolConnection | null = null;

    try {
      const actor = req.hkUser!;
      const ticketId = Number(req.params.id);

      if (!Number.isFinite(ticketId) || ticketId <= 0) {
        return res.status(400).json({ error: "Invalid ticket id." });
      }

      const message = String(req.body?.message ?? "").trim();
      const status = String(req.body?.status ?? "")
        .trim()
        .toLowerCase();

      if (message.length < 2) {
        return res.status(400).json({ error: "Reply is too short." });
      }
      if (message.length > 2000) {
        return res.status(400).json({ error: "Reply is too long (max 2000)." });
      }

      if (status && !ALLOWED_TICKET_STATUS.has(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [tRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status FROM support_tickets WHERE id = ? LIMIT 1`,
        [ticketId],
      );
      if (!tRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: "Ticket not found." });
      }

      await conn.query<ResultSetHeader>(
        `
INSERT INTO support_ticket_messages (ticket_id, user_id, message)
VALUES (?, ?, ?)
`,
        [ticketId, actor.id, message],
      );

      if (status) {
        await conn.query<ResultSetHeader>(
          `
UPDATE support_tickets
SET status = ?, updated_at = NOW()
WHERE id = ?
LIMIT 1
`,
          [status, ticketId],
        );
      } else {
        await conn.query<ResultSetHeader>(
          `UPDATE support_tickets SET updated_at = NOW() WHERE id = ? LIMIT 1`,
          [ticketId],
        );
      }

      await conn.commit();

      await hkAudit(req, {
        action: "tickets.reply",
        targetType: "support_ticket",
        targetId: ticketId,
        details: { status: status || null },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      try {
        if (conn) await conn.rollback();
      } catch {}
      console.error("HK TICKET REPLY ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    } finally {
      try {
        if (conn) conn.release();
      } catch {}
    }
  },
);

// CHANGE STATUS ONLY
hkRouter.patch(
  "/tickets/:id/status",
  requireHKPermission("hk.tickets.edit"),
  async (req, res) => {
    try {
      const actor = req.hkUser!;
      const ticketId = Number(req.params.id);

      if (!Number.isFinite(ticketId) || ticketId <= 0) {
        return res.status(400).json({ error: "Invalid ticket id." });
      }

      const status = String(req.body?.status ?? "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_TICKET_STATUS.has(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `
UPDATE support_tickets
SET status = ?, updated_at = NOW()
WHERE id = ?
LIMIT 1
`,
        [status, ticketId],
      );

      if (!result.affectedRows) {
        return res.status(404).json({ error: "Ticket not found." });
      }

      await hkAudit(req, {
        action: "tickets.status",
        targetType: "support_ticket",
        targetId: ticketId,
        details: { status, by: actor.username },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK TICKET STATUS ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

// BETA KEYS (unchanged)
hkRouter.post(
  "/settings/beta-keys",
  requireHKPermission("hk.settings.edit"),
  async (req, res) => {
    try {
      const code = String(req.body?.code ?? "").trim();

      if (code.length < 4) {
        return res
          .status(400)
          .json({ error: "Beta key must be at least 4 characters." });
      }

      const normalized = code.toUpperCase();

      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM beta_keys WHERE code = ? LIMIT 1",
        [normalized],
      );
      if ((existing as any[]).length) {
        return res.status(400).json({ error: "That beta key already exists." });
      }

      await pool.query("INSERT INTO beta_keys (code, used) VALUES (?, 0)", [
        normalized,
      ]);

      await hkAudit(req, {
        action: "beta_keys.create",
        targetType: "beta_key",
        targetId: normalized,
        details: { code: normalized },
      });

      return res.json({ ok: true, code: normalized });
    } catch (e: any) {
      console.error("HK BETA KEY CREATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

/* =========================
CMS SETTINGS (key/value)
========================= */

hkRouter.get(
  "/settings",
  requireHKPermission("hk.settings.view"),
  async (_req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT setting_key, setting_value, updated_at FROM cms_settings ORDER BY setting_key ASC",
      );

      return res.json({
        ok: true,
        items: (rows as any[]).map((r) => ({
          key: String(r.setting_key),
          value: String(r.setting_value),
          updatedAt: String(r.updated_at),
        })),
      });
    } catch (e: any) {
      console.error("HK SETTINGS LIST ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

hkRouter.put(
  "/settings/:key",
  requireHKPermission("hk.settings.edit"),
  async (req, res) => {
    try {
      const key = String(req.params.key || "").trim();
      const value = String(req.body?.value ?? "");

      if (!key) return res.status(400).json({ error: "Key is required" });

      // ✅ Rank 7 only can edit hotel_name
      if (key === "hotel_name") {
        if (!hasPermission(req.hkPerms, "hk.settings.hotelname")) {
          return res
            .status(403)
            .json({ error: "Only Rank 7 can edit Hotel Name." });
        }
      }

      await pool.query(
        `
INSERT INTO cms_settings (setting_key, setting_value)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE
setting_value = VALUES(setting_value),
updated_at = CURRENT_TIMESTAMP
`,
        [key, value],
      );

      await hkAudit(req, {
        action: "settings.update",
        targetType: "cms_setting",
        targetId: key,
        details: { value },
      });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("HK SETTINGS UPDATE ERROR:", e);
      return res.status(500).json({ error: e?.message || "Server error" });
    }
  },
);

import { Router } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db";
import { requireAuth } from "../auth";
import { requireHousekeepingAccess, requireHKPermission } from "./middleware";
import { hkAudit } from "./audit";

const r = Router();
r.use(requireAuth);
r.use(requireHousekeepingAccess);

// LIST
r.get("/", requireHKPermission("hk.news.view"), async (req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, title, body, image, created_by, created_at, updated_at FROM cms_news ORDER BY id DESC LIMIT 200",
    );

    return res.json({
      ok: true,
      items: rows.map((x: any) => ({
        id: Number(x.id),
        title: String(x.title),
        body: String(x.body),
        image: x.image ? String(x.image) : "",
        createdBy: String(x.created_by),
        createdAt: String(x.created_at),
        updatedAt: x.updated_at ? String(x.updated_at) : "",
      })),
    });
  } catch (e: any) {
    console.error("HK NEWS LIST ERROR:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// CREATE
r.post("/", requireHKPermission("hk.news.edit"), async (req, res) => {
  try {
    const actor = req.hkUser!;
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const image = String(req.body?.image ?? "").trim();

    if (!title || title.length > 120)
      return res.status(400).json({ error: "Title is required (max 120)." });
    if (!body) return res.status(400).json({ error: "Body is required." });

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO cms_news (title, body, image, created_by) VALUES (?, ?, ?, ?)",
      [title, body, image || null, actor.username],
    );

    await hkAudit(req, {
      action: "news.create",
      targetType: "news",
      targetId: Number(result.insertId),
      details: { title },
    });

    return res.json({ ok: true, id: Number(result.insertId) });
  } catch (e: any) {
    console.error("HK NEWS CREATE ERROR:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// UPDATE
r.put("/:id", requireHKPermission("hk.news.edit"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: "Invalid id" });

    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const image = String(req.body?.image ?? "").trim();

    if (!title || title.length > 120)
      return res.status(400).json({ error: "Title is required (max 120)." });
    if (!body) return res.status(400).json({ error: "Body is required." });

    await pool.query(
      "UPDATE cms_news SET title = ?, body = ?, image = ?, updated_at = NOW() WHERE id = ? LIMIT 1",
      [title, body, image || null, id],
    );

    await hkAudit(req, {
      action: "news.update",
      targetType: "news",
      targetId: id,
      details: { title },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("HK NEWS UPDATE ERROR:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// DELETE
r.delete("/:id", requireHKPermission("hk.news.edit"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ error: "Invalid id" });

    await pool.query("DELETE FROM cms_news WHERE id = ? LIMIT 1", [id]);

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
});

export default r;

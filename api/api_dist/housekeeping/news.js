"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../auth");
const middleware_1 = require("./middleware");
const audit_1 = require("./audit");
const r = (0, express_1.Router)();
r.use(auth_1.requireAuth);
r.use(middleware_1.requireHousekeepingAccess);
// LIST
r.get("/", (0, middleware_1.requireHKPermission)("hk.news.view"), async (req, res) => {
    try {
        const [rows] = await db_1.pool.query("SELECT id, title, body, image, created_by, created_at, updated_at FROM cms_news ORDER BY id DESC LIMIT 200");
        return res.json({
            ok: true,
            items: rows.map((x) => ({
                id: Number(x.id),
                title: String(x.title),
                body: String(x.body),
                image: x.image ? String(x.image) : "",
                createdBy: String(x.created_by),
                createdAt: String(x.created_at),
                updatedAt: x.updated_at ? String(x.updated_at) : "",
            })),
        });
    }
    catch (e) {
        console.error("HK NEWS LIST ERROR:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});
// CREATE
r.post("/", (0, middleware_1.requireHKPermission)("hk.news.edit"), async (req, res) => {
    try {
        const actor = req.hkUser;
        const title = String(req.body?.title ?? "").trim();
        const body = String(req.body?.body ?? "").trim();
        const image = String(req.body?.image ?? "").trim();
        if (!title || title.length > 120)
            return res.status(400).json({ error: "Title is required (max 120)." });
        if (!body)
            return res.status(400).json({ error: "Body is required." });
        const [result] = await db_1.pool.query("INSERT INTO cms_news (title, body, image, created_by) VALUES (?, ?, ?, ?)", [title, body, image || null, actor.username]);
        await (0, audit_1.hkAudit)(req, {
            action: "news.create",
            targetType: "news",
            targetId: Number(result.insertId),
            details: { title },
        });
        return res.json({ ok: true, id: Number(result.insertId) });
    }
    catch (e) {
        console.error("HK NEWS CREATE ERROR:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});
// UPDATE
r.put("/:id", (0, middleware_1.requireHKPermission)("hk.news.edit"), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "Invalid id" });
        const title = String(req.body?.title ?? "").trim();
        const body = String(req.body?.body ?? "").trim();
        const image = String(req.body?.image ?? "").trim();
        if (!title || title.length > 120)
            return res.status(400).json({ error: "Title is required (max 120)." });
        if (!body)
            return res.status(400).json({ error: "Body is required." });
        await db_1.pool.query("UPDATE cms_news SET title = ?, body = ?, image = ?, updated_at = NOW() WHERE id = ? LIMIT 1", [title, body, image || null, id]);
        await (0, audit_1.hkAudit)(req, {
            action: "news.update",
            targetType: "news",
            targetId: id,
            details: { title },
        });
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("HK NEWS UPDATE ERROR:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});
// DELETE
r.delete("/:id", (0, middleware_1.requireHKPermission)("hk.news.edit"), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0)
            return res.status(400).json({ error: "Invalid id" });
        await db_1.pool.query("DELETE FROM cms_news WHERE id = ? LIMIT 1", [id]);
        await (0, audit_1.hkAudit)(req, {
            action: "news.delete",
            targetType: "news",
            targetId: id,
        });
        return res.json({ ok: true });
    }
    catch (e) {
        console.error("HK NEWS DELETE ERROR:", e);
        return res.status(500).json({ error: e?.message || "Server error" });
    }
});
exports.default = r;

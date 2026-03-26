import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { requireAuth } from "../auth";
import { requireRank } from "./requireRank";

const router = Router();

// rank 4+ to access housekeeping wordfilter
router.use(requireAuth, requireRank(4));

type WordFilterRow = RowDataPacket & {
  word: string;
  replacement: string;
  strict: "0" | "1";
  addedby: string;
  bannable: "0" | "1";
};

// GET /api/hk/wordfilter?search=&limit=&offset=
router.get("/", async (req, res) => {
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

    // total for pagination
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM wordfilter ${search ? "WHERE word LIKE ? OR replacement LIKE ? OR addedby LIKE ?" : ""}`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [],
    );

    const total = countRows.length ? Number((countRows[0] as any).cnt ?? 0) : 0;

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
    console.error("HK wordfilter list error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// POST /api/hk/wordfilter
router.post("/", async (req, res) => {
  try {
    const u = (req as any).user as {
      id: number;
      username: string;
      rank?: number;
    };

    const word = String(req.body?.word ?? "").trim();
    const replacement = String(req.body?.replacement ?? "").trim();
    const bannable = Boolean(req.body?.bannable);
    const strict =
      req.body?.strict === undefined ? true : Boolean(req.body?.strict);

    if (word.length < 1 || word.length > 100) {
      return res.status(400).json({ error: "Word must be 1-100 characters." });
    }
    if (replacement.length > 255) {
      return res.status(400).json({ error: "Replacement max length is 255." });
    }

    // word is PRIMARY KEY, so duplicates will fail
    await pool.query<ResultSetHeader>(
      `
INSERT INTO wordfilter (word, replacement, strict, addedby, bannable)
VALUES (?, ?, ?, ?, ?)
`,
      [word, replacement, strict ? "1" : "0", u.username, bannable ? "1" : "0"],
    );

    return res.json({ ok: true });
  } catch (e: any) {
    // duplicate key
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "That word already exists." });
    }
    console.error("HK wordfilter create error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// PUT /api/hk/wordfilter/:word
// supports editing replacement/bannable/strict
// and optionally renaming the word using body.newWord
router.put("/:word", async (req, res) => {
  try {
    const oldWord = String(req.params.word ?? "").trim();
    if (!oldWord) return res.status(400).json({ error: "Invalid word." });

    const newWord = String(req.body?.newWord ?? "").trim();
    const replacement = String(req.body?.replacement ?? "").trim();
    const bannable = Boolean(req.body?.bannable);
    const strict =
      req.body?.strict === undefined ? true : Boolean(req.body?.strict);

    if (replacement.length > 255) {
      return res.status(400).json({ error: "Replacement max length is 255." });
    }
    if (newWord && (newWord.length < 1 || newWord.length > 100)) {
      return res
        .status(400)
        .json({ error: "New word must be 1-100 characters." });
    }

    // If renaming the PK, do it safely
    if (newWord && newWord !== oldWord) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // read existing addedby
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

        // insert new row first
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

        // delete old
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

    // Normal update
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

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("HK wordfilter update error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

// DELETE /api/hk/wordfilter/:word
router.delete("/:word", async (req, res) => {
  try {
    const word = String(req.params.word ?? "").trim();
    if (!word) return res.status(400).json({ error: "Invalid word." });

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM wordfilter WHERE word = ? LIMIT 1",
      [word],
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: "Word not found." });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("HK wordfilter delete error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
});

export default router;

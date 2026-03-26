"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRank = requireRank;
const db_1 = require("../db");
function requireRank(minRank) {
    return async (req, res, next) => {
        try {
            const u = req.user;
            if (!u?.id)
                return res.status(401).json({ error: "Unauthorized" });
            const [rows] = await db_1.pool.query("SELECT `rank` FROM users WHERE id = ? LIMIT 1", [u.id]);
            const rank = rows.length ? Number(rows[0].rank ?? 0) : 0;
            // attach for later use if you want
            req.user.rank = rank;
            if (rank < minRank) {
                return res.status(403).json({ error: "Forbidden" });
            }
            return next();
        }
        catch (e) {
            console.error("requireRank error:", e);
            return res.status(500).json({ error: e?.message || "Server error" });
        }
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireHousekeepingAccess = requireHousekeepingAccess;
exports.requireHKPermission = requireHKPermission;
const db_1 = require("../db");
const permissions_1 = require("./permissions");
async function requireHousekeepingAccess(req, res, next) {
    try {
        // requireAuth already set (req as any).user = { id, username }
        const baseUser = req.user;
        if (!baseUser?.id)
            return res.status(401).json({ message: "Unauthorized" });
        const [rows] = await db_1.pool.query("SELECT username, `rank` FROM users WHERE id = ? LIMIT 1", [baseUser.id]);
        if (!rows.length)
            return res.status(401).json({ message: "Unauthorized" });
        const rank = Number(rows[0].rank ?? 0);
        const username = String(rows[0].username ?? baseUser.username);
        if (rank < 4)
            return res.status(403).json({ message: "Forbidden (rank too low)" });
        req.hkUser = { id: baseUser.id, username, rank };
        req.hkPerms = (0, permissions_1.getPermissionsForRank)(rank);
        return next();
    }
    catch (e) {
        console.error("HK ACCESS ERROR:", e);
        return res.status(500).json({ message: "Server error" });
    }
}
function requireHKPermission(permission) {
    return (req, res, next) => {
        const perms = req.hkPerms;
        if (!perms || !perms.has(permission)) {
            return res
                .status(403)
                .json({ message: "Forbidden (missing permission)" });
        }
        return next();
    };
}

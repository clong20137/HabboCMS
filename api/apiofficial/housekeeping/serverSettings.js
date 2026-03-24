"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServerSettingsRoutes = registerServerSettingsRoutes;
const db_1 = require("../db");
const middleware_1 = require("./middleware");
function normalizeKey(k) {
    return String(k ?? "").trim();
}
function normalizeValue(v) {
    return String(v ?? "");
}
function registerServerSettingsRoutes(hkRouter) {
    hkRouter.get("/server-settings", (0, middleware_1.requireHKPermission)("hk.server_settings.edit"), async (_req, res) => {
        try {
            const [rows] = await db_1.pool.query(`
SELECT \`key\`, \`value\`
FROM emulator_settings
ORDER BY \`key\` ASC
`);
            return res.json({
                ok: true,
                items: rows.map((r) => ({
                    key: String(r.key),
                    value: String(r.value ?? ""),
                })),
            });
        }
        catch (e) {
            console.error("HK SERVER SETTINGS LIST ERROR:", e);
            return res.status(500).json({ error: "Server error" });
        }
    });
    hkRouter.put("/server-settings/:key", (0, middleware_1.requireHKPermission)("hk.server_settings.edit"), async (req, res) => {
        try {
            const key = normalizeKey(req.params.key);
            const value = normalizeValue(req.body?.value);
            if (!key) {
                return res.status(400).json({ error: "Key is required." });
            }
            if (key.length > 100) {
                return res.status(400).json({ error: "Key is too long." });
            }
            if (value.length > 512) {
                return res.status(400).json({ error: "Value is too long." });
            }
            const [existing] = await db_1.pool.query("SELECT `key` FROM emulator_settings WHERE `key` = ? LIMIT 1", [key]);
            if (!existing.length) {
                return res.status(404).json({ error: "Setting not found." });
            }
            await db_1.pool.query("UPDATE emulator_settings SET `value` = ? WHERE `key` = ? LIMIT 1", [value, key]);
            return res.json({ ok: true });
        }
        catch (e) {
            console.error("HK SERVER SETTINGS UPDATE ERROR:", e);
            return res.status(500).json({ error: "Server error" });
        }
    });
}

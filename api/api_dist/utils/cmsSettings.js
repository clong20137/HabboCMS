"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCmsSetting = getCmsSetting;
async function getCmsSetting(poolOrConn, key, fallback = "") {
    try {
        const [rows] = await poolOrConn.query("SELECT `setting_value` FROM cms_settings WHERE `setting_key` = ? LIMIT 1", [key]);
        if (!rows.length)
            return fallback;
        return String(rows[0].setting_value ?? fallback);
    }
    catch {
        // If cms_settings table doesn't exist (or any SQL error), don't crash the whole API.
        return fallback;
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUnusedBetaKeyIdByCode = findUnusedBetaKeyIdByCode;
exports.markBetaKeyUsed = markBetaKeyUsed;
async function findUnusedBetaKeyIdByCode(pool, code) {
    try {
        const [rows] = await pool.query("SELECT id FROM beta_keys WHERE code = ? AND used = 0 LIMIT 1", [code]);
        if (!rows.length)
            return null;
        return Number(rows[0].id);
    }
    catch {
        // beta_keys missing or query fails -> behave as if no valid key
        return null;
    }
}
async function markBetaKeyUsed(pool, params) {
    try {
        await pool.query("UPDATE beta_keys SET used = 1, used_by = ?, used_at = NOW() WHERE id = ? AND used = 0 LIMIT 1", [params.usedByUserId, params.betaKeyId]);
    }
    catch {
        // ignore if table is missing; registration will still succeed in non-beta mode
    }
}

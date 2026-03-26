"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorporationForUser = getCorporationForUser;
async function getCorporationForUser(pool, userId) {
    const [rows] = await pool.query(`
SELECT
cm.corporation_id,
c.name AS corporation_name,
c.icon AS corporation_icon,
c.can_work_anywhere,
cm.rank_id,
cr.rank_name,
cr.rank_order,
cm.is_manager,
cm.weekly_shifts,
cm.total_shifts
FROM corporation_members cm
INNER JOIN corporations c
ON c.id = cm.corporation_id
LEFT JOIN corporation_ranks cr
ON cr.id = cm.rank_id
WHERE cm.user_id = ?
LIMIT 1
`, [userId]);
    return rows.length ? rows[0] : null;
}

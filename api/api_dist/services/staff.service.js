"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaff = getStaff;
const users_repo_1 = require("../repositories/users.repo");
async function getStaff(pool, minRank) {
    const rows = await (0, users_repo_1.listStaff)(pool, minRank);
    return rows.map((u) => ({
        id: Number(u.id),
        username: String(u.username),
        motto: u.motto ?? null,
        rank: Number(u.rank ?? 0),
        figure: u.look ?? null,
    }));
}

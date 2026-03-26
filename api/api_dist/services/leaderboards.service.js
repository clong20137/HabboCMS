"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEADERBOARD_FIELDS = void 0;
exports.getLeaderboard = getLeaderboard;
const AppError_1 = require("../errors/AppError");
const users_repo_1 = require("../repositories/users.repo");
exports.LEADERBOARD_FIELDS = new Set([
    "credits",
    "bank_credits",
    "kills",
    "deaths",
    "punches_thrown",
    "punches_landed",
    "damage_inflicted",
    "damage_received",
    "robberies",
    "arrests",
    "xp",
    "arena_wins",
    "arena_losses",
    "strength",
    "defense",
    "stamina",
    "gathering",
    "knowledge",
]);
async function getLeaderboard(pool, params) {
    if (!exports.LEADERBOARD_FIELDS.has(params.field)) {
        throw new AppError_1.AppError(400, "Invalid leaderboard field.", { code: "BAD_REQUEST" });
    }
    const rows = await (0, users_repo_1.leaderboardByField)(pool, params.field, params.limit);
    return rows.map((r) => ({
        id: Number(r.id),
        username: String(r.username),
        figure: r.look ?? null,
        value: Number(r.value ?? 0),
    }));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissionsForRank = getPermissionsForRank;
exports.hasPermission = hasPermission;
const rankPermissions = {
    4: [
        "hk.access",
        "hk.user.view",
        "hk.chatlogs.view",
        "hk.wordfilter.view",
        "hk.news.view",
        "hk.tickets.view",
        "hk.bans.view",
    ],
    5: ["hk.wordfilter.edit", "hk.news.edit"],
    6: [
        "hk.user.edit",
        "hk.settings.view",
        "hk.settings.edit",
        "hk.nitro.view",
        "hk.nitro.edit",
        "hk.audit.view",
        "hk.tickets.edit",
        "hk.bans.edit",
    ],
    // ✅ Rank 7 inherits everything below (because of getPermissionsForRank logic)
    // and gets rank-7-only permissions here:
    7: ["hk.settings.hotelname", "hk.server_settings.edit"],
};
function getPermissionsForRank(rank) {
    const out = [];
    const ranks = Object.keys(rankPermissions)
        .map(Number)
        .sort((a, b) => a - b);
    for (const r of ranks) {
        if (rank >= r)
            out.push(...rankPermissions[r]);
    }
    // Always ensure HK access for rank >= 4
    if (rank >= 4 && !out.includes("hk.access"))
        out.push("hk.access");
    return new Set(out);
}
function hasPermission(perms, p) {
    return !!perms && perms.has(p);
}

export type HKPermission =
  | "hk.access"
  | "hk.user.view"
  | "hk.user.edit"
  | "hk.chatlogs.view"
  | "hk.wordfilter.view"
  | "hk.wordfilter.edit"
  | "hk.settings.view"
  | "hk.settings.edit"
  | "hk.settings.hotelname" // Rank 7 only
  | "hk.nitro.view"
  | "hk.nitro.edit"
  | "hk.news.view"
  | "hk.news.edit"
  | "hk.audit.view"
  | "hk.tickets.view"
  | "hk.tickets.edit"
  | "hk.bans.edit"
  | "hk.bans.view"
  | "hk.server_settings.edit"; 

const rankPermissions: Record<number, HKPermission[]> = {
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

export function getPermissionsForRank(rank: number): Set<HKPermission> {
  const out: HKPermission[] = [];
  const ranks = Object.keys(rankPermissions)
    .map(Number)
    .sort((a, b) => a - b);

  for (const r of ranks) {
    if (rank >= r) out.push(...rankPermissions[r]);
  }

  // Always ensure HK access for rank >= 4
  if (rank >= 4 && !out.includes("hk.access")) out.push("hk.access");

  return new Set(out);
}

export function hasPermission(
  perms: Set<HKPermission> | undefined,
  p: HKPermission,
) {
  return !!perms && perms.has(p);
}

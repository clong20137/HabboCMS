import { useEffect, useMemo, useRef, useState } from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { api } from "../api/client";
import { getAvatarUrl } from "../utils/avatar";
import { useHotelTitle } from "../hooks/useHotelTitle";
import badgeADM from "../assets/staff/ADM.gif";
import badgeHBA from "../assets/staff/HBA.gif";
import badgeNWB from "../assets/staff/NWB.gif";
import badgeEXH from "../assets/staff/EXH.gif";

type StaffMember = {
  id: number;
  username: string;
  motto?: string | null;
  rank: number;
  figure?: string | null;
};

type RankGroup = {
  rank: number;
  title: string;
  members: StaffMember[];
};

const rankBadges: Record<number, string | undefined> = {
  7: badgeADM,
  6: badgeHBA,
  5: badgeNWB,
  4: badgeEXH,
};

const rankTitles: Record<number, string> = {
  7: "Developers",
  6: "Support Staff",
  5: "Moderators",
  4: "Trial Moderators",
};

function sortByRankDesc(a: RankGroup, b: RankGroup) {
  return b.rank - a.rank;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`staff-chevron ${open ? "open" : ""}`} aria-hidden="true">
      ▾
    </span>
  );
}

export default function Staff() {
  useHotelTitle("Staff Team");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<RankGroup[]>([]);
  const [openRanks, setOpenRanks] = useState<Record<number, boolean>>({});
  const contentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [heights, setHeights] = useState<Record<number, number>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.getStaff();
        const staff: StaffMember[] = res?.staff ?? [];

        const byRank = new Map<number, StaffMember[]>();
        for (const m of staff) {
          if (!byRank.has(m.rank)) byRank.set(m.rank, []);
          byRank.get(m.rank)!.push(m);
        }

        const built: RankGroup[] = Object.keys(rankTitles).map((k) => {
          const rank = Number(k);
          const members = (byRank.get(rank) ?? [])
            .slice()
            .sort((a, b) => a.username.localeCompare(b.username));
          return { rank, title: rankTitles[rank], members };
        });

        built.sort(sortByRankDesc);

        if (!mounted) return;

        setGroups(built);

        const nextOpen: Record<number, boolean> = {};
        for (const g of built) nextOpen[g.rank] = true;
        setOpenRanks(nextOpen);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load staff.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const next: Record<number, number> = {};

    for (const g of groups) {
      const el = contentRefs.current[g.rank];
      if (!el) continue;
      next[g.rank] = openRanks[g.rank] ? el.scrollHeight : 0;
    }

    setHeights(next);
  }, [groups, openRanks]);

  function toggleRank(rank: number) {
    setOpenRanks((prev) => ({ ...prev, [rank]: !prev[rank] }));
  }

  const totalStaff = useMemo(
    () => groups.reduce((sum, g) => sum + g.members.length, 0),
    [groups],
  );

  return (
    <SiteLayout active="community">
      <div className="staff-grid">
        <div className="staff-left">
          <section className="panel">
            <div className="panel-head">STAFF TEAM</div>
            <div className="panel-body">
              {loading ? (
                <div className="muted">Loading staff...</div>
              ) : error ? (
                <div className="form-alert form-alert--error">{error}</div>
              ) : (
                <div className="staff-ranks">
                  {groups.map((group) => {
                    const badge = rankBadges[group.rank];
                    const isOpen = !!openRanks[group.rank];

                    return (
                      <section key={group.rank} className="staff-rank panel">
                        <button
                          type="button"
                          className="staff-rank__head"
                          onClick={() => toggleRank(group.rank)}
                        >
                          <div className="staff-rank__left">
                            {badge ? (
                              <img
                                className="staff-rank__badge"
                                src={badge}
                                alt=""
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="staff-rank__badge staff-rank__badge--empty" />
                            )}

                            <div className="staff-rank__title">
                              {group.title} ({group.members.length})
                            </div>
                          </div>

                          <Chevron open={isOpen} />
                          <span
                            className="staff-rank__shine"
                            aria-hidden="true"
                          />
                        </button>

                        <div
                          className="staff-collapse"
                          style={{ maxHeight: heights[group.rank] ?? 0 }}
                        >
                          <div
                            className="staff-collapse__inner"
                            ref={(el) => {
                              contentRefs.current[group.rank] = el;
                            }}
                          >
                            {group.members.length > 0 ? (
                              <div className="staff-members">
                                {group.members.map((member) => (
                                  <div key={member.id} className="staff-member">
                                    <div className="staff-avatar">
                                      <img
                                        className="staff-avatar__img"
                                        src={getAvatarUrl(member.figure, {
                                          headOnly: true,
                                          size: "l",
                                        })}
                                        alt={member.username}
                                      />
                                    </div>
                                    <div className="staff-meta">
                                      <div className="staff-name">
                                        {member.username}
                                      </div>
                                      <div className="staff-sub">
                                        {member.motto ||
                                          "Helping keep the hotel running."}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="staff-empty muted">
                                No staff members in this rank.
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="staff-right">
          <section className="panel">
            <div className="panel-head">ABOUT THE TEAM</div>
            <div className="panel-body">
              <p className="staff-about">
                Our staff team helps moderate the hotel, support players, and keep the
                community running smoothly. Reach out if you need help in-game.
              </p>
     
            </div>
          </section>
        </aside>
      </div>
    </SiteLayout>
  );
}

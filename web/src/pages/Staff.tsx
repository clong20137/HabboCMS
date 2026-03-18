import { useEffect, useMemo, useRef, useState } from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { api } from "../api/client";
import { useHotelTitle } from "../hooks/useHotelTitle";
// Rank badge gifs
import badgeADM from "../assets/staff/ADM.gif"; // rank 7
import badgeHBA from "../assets/staff/HBA.gif"; // rank 6
import badgeNWB from "../assets/staff/NWB.gif"; // rank 5
import badgeEXH from "../assets/staff/EXH.gif"; // rank 4

type StaffMember = {
  id: number;
  username: string;
  motto?: string | null;
  rank: number;
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

// Optional: set rank titles here so you control the labels (reference style)
const rankTitles: Record<number, string> = {
  7: "Developers",
  6: "Support Staff",
  5: "Moderators",
  4: "Trial Moderators",
};

// Helper: keep highest rank at top
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

  // collapse state: which ranks are open
  const [openRanks, setOpenRanks] = useState<Record<number, boolean>>({});

  // refs to measure height for smooth animation
  const contentRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // heights computed per rank (for animated max-height)
  const [heights, setHeights] = useState<Record<number, number>>({});

  // Load staff from API
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // You should implement this in api/client.ts:
        // GET /api/staff -> { ok: true, staff: StaffMember[] }
        const res = await api.getStaff();

  const staff: StaffMember[] = res?.staff ?? [];

        // Group by rank (only ranks we care about for now: 7..4)
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

        // default open all ranks on first load
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

  // Measure heights whenever:
  // - groups change
  // - open/close toggles
  // This keeps the animation smooth and accurate.
  useEffect(() => {
    const next: Record<number, number> = {};

    for (const g of groups) {
      const el = contentRefs.current[g.rank];
      if (!el) continue;

      // If open: use scrollHeight. If closed: 0
      next[g.rank] = openRanks[g.rank] ? el.scrollHeight : 0;
    }

    setHeights(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, openRanks]);

  function toggleRank(rank: number) {
    setOpenRanks((prev) => ({ ...prev, [rank]: !prev[rank] }));
  }

  const aboutText = useMemo(
    () =>
      "Most of our team consists of experienced players, but we always keep an eye out for people who stand out and contribute positively to the community.",
    [],
  );

  return (
    <SiteLayout active="community">
      <div className="staff-grid">
        {/* LEFT: ranks */}
        <div className="staff-left">
          <div className="panel">
            <div className="panel-head">STAFF</div>
            <div className="panel-body">
              {loading && <div className="muted">Loading staff...</div>}

              {!loading && error && (
                <div
                  className="form-alert form-alert--error"
                  style={{ marginBottom: 0 }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="staff-ranks">
                  {groups.map((g) => {
                    const open = !!openRanks[g.rank];
                    const badgeSrc = rankBadges[g.rank];

                    return (
                      <div key={g.rank} className="staff-rank panel">
                        {/* Rank Header (click to collapse) */}
                        <button
                          type="button"
                          className={`staff-rank__head ${open ? "is-open" : ""}`}
                          onClick={() => toggleRank(g.rank)}
                          aria-expanded={open}
                        >
                          <div className="staff-rank__left">
                            {badgeSrc ? (
                              <img
                                className="staff-rank__badge"
                                src={badgeSrc}
                                alt={g.title}
                              />
                            ) : (
                              <span
                                className="staff-rank__badge staff-rank__badge--empty"
                                aria-hidden="true"
                              />
                            )}

                            <div className="staff-rank__title">{g.title}</div>
                          </div>

                          <Chevron open={open} />
                          <span
                            className="staff-rank__shine"
                            aria-hidden="true"
                          />
                        </button>

                        {/* Collapsible Body (smooth height animation) */}
                        <div
                          className="staff-collapse"
                          style={{ maxHeight: (heights[g.rank] ?? 0) + "px" }}
                        >
                          <div
                            className="staff-collapse__inner"
                            ref={(node) => {
                              contentRefs.current[g.rank] = node;
                            }}
                          >
                            {g.members.length === 0 ? (
                              <div className="staff-empty muted">
                                No staff members in this rank.
                              </div>
                            ) : (
                              <div className="staff-members">
                                {g.members.map((m) => (
                                  <div key={m.id} className="staff-member">
                                    <div className="staff-avatar" />
                                    <div className="staff-meta">
                                      <div className="staff-name">
                                        {m.username}
                                      </div>
                                      <div className="staff-sub muted">
                                        {m.motto || "—"}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: about panel */}
        <aside className="staff-right">
          <div className="panel">
            <div className="panel-head">ABOUT STAFF</div>
            <div className="panel-body">
              <p className="staff-about muted">{aboutText}</p>
            </div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}

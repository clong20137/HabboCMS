import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { api, type LeaderboardItem } from "../api/client";
import "../styles/leaderboards.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

type StatKey =
  | "credits"
  | "bank_credits"
  | "kills"
  | "deaths"
  | "punches_thrown"
  | "punches_landed"
  | "arrests"
  | "robberies"
  | "damage_inflicted"
  | "damage_received"
  | "xp"
  | "arena_wins"
  | "arena_losses"
  | "strength"
  | "defense"
  | "stamina"
  | "gathering"
  | "knowledge";

type BoardCard = {
  key: StatKey;
  title: string;
  iconSrc: string;
  load: () => Promise<LeaderboardItem[]>;
  valueLabel: (n: number) => string;
  valueRight: (n: number) => string;
};

const CROSSFADE_MS = 420;

const icon = (file: string) =>
  new URL(`../assets/leaderboards/${file}`, import.meta.url).href;

export default function Leaderboards() {
  useHotelTitle("Leaderboards");

  const boards: BoardCard[] = useMemo(
    () => [
      {
        key: "credits",
        title: "MOST CREDITS",
        iconSrc: icon("intellect.png"),
        load: () => api.getLeaderboard("credits", 10),
        valueLabel: (n) => `${formatNumber(n)} Credits`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "bank_credits",
        title: "MOST BANK",
        iconSrc: icon("bank.png"),
        load: () => api.getLeaderboard("bank_credits", 10),
        valueLabel: (n) => `${formatNumber(n)} Bank`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "kills",
        title: "MOST KILLS",
        iconSrc: icon("kills.png"),
        load: () => api.getLeaderboard("kills", 10),
        valueLabel: (n) => `${formatNumber(n)} Kills`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "deaths",
        title: "MOST DEATHS",
        iconSrc: icon("deaths.png"),
        load: () => api.getLeaderboard("deaths", 10),
        valueLabel: (n) => `${formatNumber(n)} Deaths`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "punches_thrown",
        title: "PUNCHES THROWN",
        iconSrc: icon("punches_thrown.png"),
        load: () => api.getLeaderboard("punches_thrown", 10),
        valueLabel: (n) => `${formatNumber(n)} Punches Thrown`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "punches_landed",
        title: "PUNCHES LANDED",
        iconSrc: icon("punches_received.png"),
        load: () => api.getLeaderboard("punches_landed", 10),
        valueLabel: (n) => `${formatNumber(n)} Punches Landed`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "arrests",
        title: "MOST ARRESTS",
        iconSrc: icon("cuffs.png"),
        load: () => api.getLeaderboard("arrests", 10),
        valueLabel: (n) => `${formatNumber(n)} Arrests`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "robberies",
        title: "MOST ROBBERIES",
        iconSrc: icon("bank.png"),
        load: () => api.getLeaderboard("robberies", 10),
        valueLabel: (n) => `${formatNumber(n)} Robberies`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "damage_inflicted",
        title: "DAMAGE INFLICTED",
        iconSrc: icon("damage.png"),
        load: () => api.getLeaderboard("damage_inflicted", 10),
        valueLabel: (n) => `${formatNumber(n)} Damage`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "damage_received",
        title: "DAMAGE RECEIVED",
        iconSrc: icon("damage.png"),
        load: () => api.getLeaderboard("damage_received", 10),
        valueLabel: (n) => `${formatNumber(n)} Damage`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "strength",
        title: "TOP STRENGTH",
        iconSrc: icon("kills.png"),
        load: () => api.getLeaderboard("strength", 10),
        valueLabel: (n) => `${formatNumber(n)} Strength`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "knowledge",
        title: "TOP KNOWLEDGE",
        iconSrc: icon("intellect.png"),
        load: () => api.getLeaderboard("knowledge", 10),
        valueLabel: (n) => `${formatNumber(n)} Knowledge`,
        valueRight: (n) => formatNumber(n),
      },
    ],
    [],
  );

  const perPage = 3;
  const pageCount = Math.max(1, Math.ceil(boards.length / perPage));

  const [page, setPage] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "prepare" | "fading">("idle");

  const timerRef = useRef<number | null>(null);

  const [data, setData] = useState<Record<string, LeaderboardItem[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});

  const currentBoards = useMemo(() => {
    const start = page * perPage;
    return boards.slice(start, start + perPage);
  }, [boards, page]);

  const incomingBoards = useMemo(() => {
    if (nextPage === null) return null;
    const start = nextPage * perPage;
    return boards.slice(start, start + perPage);
  }, [boards, nextPage]);

  async function ensureLoaded(list: BoardCard[]) {
    for (const b of list) {
      if (data[b.key]?.length) continue;

      try {
        setLoading((m) => ({ ...m, [b.key]: true }));
        setError((m) => ({ ...m, [b.key]: null }));

        const items = await b.load();
        setData((m) => ({ ...m, [b.key]: Array.isArray(items) ? items : [] }));
      } catch (e: any) {
        setError((m) => ({
          ...m,
          [b.key]: String(e?.message || "Failed to load."),
        }));
      } finally {
        setLoading((m) => ({ ...m, [b.key]: false }));
      }
    }
  }

  useEffect(() => {
    ensureLoaded(currentBoards);
  }, [page]);

  useLayoutEffect(() => {
    if (phase !== "prepare") return;
    setPhase("fading");
  }, [phase]);

  function goTo(next: number) {
    const safe = Math.max(0, Math.min(next, pageCount - 1));
    if (safe === page) return;

    if (phase !== "idle") {
      setNextPage(safe);
      return;
    }

    setNextPage(safe);
    setPhase("prepare");

    const start = safe * perPage;
    const incoming = boards.slice(start, start + perPage);
    ensureLoaded(incoming);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPage(safe);
      setNextPage(null);
      setPhase("idle");
    }, CROSSFADE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function renderBoards(list: BoardCard[]) {
    return (
      <div className="leaderboards-grid leaderboards-grid--3">
        {list.map((board) => {
          const items = data[board.key] ?? [];
          const isLoading = !!loading[board.key];
          const err = error[board.key];

          return (
            <section key={board.key} className="leaderboard panel">
              <div className="leaderboard-head">
                <div className="leaderboard-head__left">
                  <img
                    className="leaderboard-head__iconImg"
                    src={board.iconSrc}
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                  />
                  <span className="leaderboard-head__title">{board.title}</span>
                </div>
              </div>

              <div className="panel-body leaderboard-body">
                {err && (
                  <div className="form-alert form-alert--error leaderboard-alert">
                    {err}
                  </div>
                )}

                {isLoading && !err && <div className="muted">Loading...</div>}

                {!isLoading && !err && (
                  <div className="leaderboard-list">
                    {items.length === 0 ? (
                      <div className="muted">No data yet.</div>
                    ) : (
                      items.slice(0, 10).map((u, idx) => {
                        const medalClass =
                          idx === 0
                            ? "is-gold"
                            : idx === 1
                              ? "is-silver"
                              : idx === 2
                                ? "is-bronze"
                                : "";

                        return (
                          <div
                            key={`${board.key}-${u.id}-${idx}`}
                            className={`leaderboard-row ${medalClass}`}
                          >
                            <div className="lb-left">
                              <div className="lb-rank">{idx + 1}</div>
                              <div className="lb-avatar" aria-hidden="true" />
                              <div className="lb-meta">
                                <div className="lb-name">{u.username}</div>
                                <div className="lb-sub">
                                  {board.valueLabel(Number(u.value ?? 0))}
                                </div>
                              </div>
                            </div>

                            <div className="lb-right">
                              <div className="lb-value">
                                {board.valueRight(Number(u.value ?? 0))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const currentOpacity = phase === "fading" ? 0 : 1;
  const nextOpacity = phase === "fading" ? 1 : 0;

  return (
    <SiteLayout active="community">
      <div className="leaderboards-page">
        <div className="lb-xfade-stage" style={{ minHeight: 420 }}>
          <div
            key={`page-current-${page}`}
            className="lb-xfade-layer"
            style={{
              opacity: currentOpacity,
              transition: `opacity ${CROSSFADE_MS}ms ease`,
              pointerEvents: phase === "fading" ? "none" : "auto",
            }}
          >
            {renderBoards(currentBoards)}
          </div>

          {incomingBoards && nextPage !== null && (
            <div
              key={`page-next-${nextPage}`}
              className="lb-xfade-layer"
              style={{
                opacity: nextOpacity,
                transition: `opacity ${CROSSFADE_MS}ms ease`,
                pointerEvents: "none",
              }}
            >
              {renderBoards(incomingBoards)}
            </div>
          )}
        </div>

        {pageCount > 1 && (
          <div className="leaderboards-nav">
            <button
              type="button"
              className="lb-nav-btn"
              onClick={() => goTo(page - 1)}
              disabled={phase !== "idle" || page <= 0}
              aria-label="Previous leaderboard page"
            >
              ‹
            </button>

            <div
              className="leaderboards-dots"
              role="tablist"
              aria-label="Leaderboards pages"
            >
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`lb-dot ${i === (nextPage ?? page) ? "active" : ""}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to page ${i + 1}`}
                  aria-current={i === (nextPage ?? page) ? "true" : "false"}
                />
              ))}
            </div>

            <button
              type="button"
              className="lb-nav-btn"
              onClick={() => goTo(page + 1)}
              disabled={phase !== "idle" || page >= pageCount - 1}
              aria-label="Next leaderboard page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

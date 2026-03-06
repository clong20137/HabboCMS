import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { api, LeaderboardItem } from "../api/client";
import "../styles/leaderboards.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";
function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}


type StatKey =
  | "credits"
  | "bank_amount"
  | "kills"
  | "deaths"
  | "punches_thrown"
  | "punches_received"
  | "arrests_made"
  | "arrests_amount"
  | "damage_dealt"
  | "damage_received"
  | "kd";

type BoardCard = {
  key: StatKey;
  title: string;
  iconSrc: string;
  load: () => Promise<LeaderboardItem[]>;
  valueLabel: (n: number) => string;
  valueRight: (n: number) => string;
};

const CROSSFADE_MS = 420;

export default function Leaderboards() {
  useHotelTitle("Leaderboards");
  const boards: BoardCard[] = useMemo(
    () => [
      {
        key: "credits",
        title: "MOST CREDITS",
        iconSrc: "/assets/leaderboards/intellect.png",
        load: () => api.getLeaderboard("credits", 10),
        valueLabel: (n) => `${formatNumber(n)} Credits`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "bank_amount",
        title: "MOST BANK",
        iconSrc: "/assets/leaderboards/bank.png",
        load: () => api.getLeaderboard("bank_amount", 10),
        valueLabel: (n) => `${formatNumber(n)} Bank`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "kills",
        title: "MOST KILLS",
        iconSrc: "/assets/leaderboards/kills.png",
        load: () => api.getLeaderboard("kills", 10),
        valueLabel: (n) => `${formatNumber(n)} Kills`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "deaths",
        title: "MOST DEATHS",
        iconSrc: "/assets/leaderboards/deaths.png",
        load: () => api.getLeaderboard("deaths", 10),
        valueLabel: (n) => `${formatNumber(n)} Deaths`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "punches_thrown",
        title: "PUNCHES THROWN",
        iconSrc: "/assets/leaderboards/punches_thrown.png",
        load: () => api.getLeaderboard("punches_thrown", 10),
        valueLabel: (n) => `${formatNumber(n)} Punches Thrown`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "punches_received",
        title: "PUNCHES RECEIVED",
        iconSrc: "/assets/leaderboards/punches_received.png",
        load: () => api.getLeaderboard("punches_received", 10),
        valueLabel: (n) => `${formatNumber(n)} Punches Received`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "arrests_made",
        title: "ARRESTS MADE",
        iconSrc: "/assets/leaderboards/cuffs.png",
        load: () => api.getLeaderboard("arrests_made", 10),
        valueLabel: (n) => `${formatNumber(n)} Arrests Made`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "arrests_amount",
        title: "ARREST AMOUNT",
        iconSrc: "/assets/leaderboards/cuffs.png",
        load: () => api.getLeaderboard("arrests_amount", 10),
        valueLabel: (n) => `${formatNumber(n)} Arrest Amount`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "damage_dealt",
        title: "DAMAGE DEALT",
        iconSrc: "/assets/leaderboards/damage.png",
        load: () => api.getLeaderboard("damage_dealt", 10),
        valueLabel: (n) => `${formatNumber(n)} Damage Dealt`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "damage_received",
        title: "DAMAGE RECEIVED",
        iconSrc: "/assets/leaderboards/damage.png",
        load: () => api.getLeaderboard("damage_received", 10),
        valueLabel: (n) => `${formatNumber(n)} Damage Received`,
        valueRight: (n) => formatNumber(n),
      },
      {
        key: "kd",
        title: "BEST K/D",
        iconSrc: "/assets/leaderboards/kd.png",
        load: () => api.getLeaderboard("kd", 10),
        valueLabel: (n) => `K/D ${Number(n).toFixed(2)}`,
        valueRight: (n) => Number(n).toFixed(2),
      },
    ],
    [],
  );

  const perPage = 3;
  const pageCount = Math.max(1, Math.ceil(boards.length / perPage));

  const [page, setPage] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);

  // phase: idle -> prepare (mount next at opacity 0) -> fading (crossfade) -> idle
  const [phase, setPhase] = useState<"idle" | "prepare" | "fading">("idle");

  const timerRef = useRef<number | null>(null);

  // Cache per board key
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
        setData((m) => ({ ...m, [b.key]: items }));
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

  // load visible on entry
  useEffect(() => {
    ensureLoaded(currentBoards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 🔥 This is the key: after we mount the "next" page at opacity 0,
  // useLayoutEffect flips to "fading" BEFORE paint, preventing any flash.
  useLayoutEffect(() => {
    if (phase !== "prepare") return;
    setPhase("fading");
  }, [phase]);

  function goTo(next: number) {
    const safe = Math.max(0, Math.min(next, pageCount - 1));
    if (safe === page) return;

    // if mid-transition, just update the target
    if (phase !== "idle") {
      setNextPage(safe);
      return;
    }

    // mount next page first at opacity 0 (inline style ensures 0 on first paint)
    setNextPage(safe);
    setPhase("prepare");

    // start preloading incoming, but do NOT wait (fade starts immediately)
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
                    {items.slice(0, 10).map((u, idx) => {
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
                          key={u.id}
                          className={`leaderboard-row ${medalClass}`}
                        >
                          <div className="lb-left">
                            <div className="lb-rank">{idx + 1}</div>
                            <div className="lb-avatar" aria-hidden="true" />
                            <div className="lb-meta">
                              <div className="lb-name">{u.username}</div>
                              <div className="lb-sub muted">
                                {board.valueLabel(u.value)}
                              </div>
                            </div>
                          </div>
                          <div className="lb-right">
                            <div className="lb-value">
                              {board.valueRight(u.value)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
          {/* CURRENT */}
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

          {/* NEXT */}
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

        {/* DOTS */}
        {pageCount > 1 && (
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
        )}
      </div>
    </SiteLayout>
  );
}

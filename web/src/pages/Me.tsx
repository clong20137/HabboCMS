import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { useAuth } from "../auth/AuthContext";
import { api, type NewsItem } from "../api/client";
import "../styles/me.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
function pct(current: number, max: number) {
  if (!max || max <= 0) return 0;
  return clampPct((current / max) * 100);
}

const FADE_MS = 300;

export default function Me() {
  useHotelTitle("Me");
  const nav = useNavigate();
  const { user } = useAuth();

  const isLoading = user === undefined;

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsIdx, setNewsIdx] = useState(0);

  const [isFading, setIsFading] = useState(false);
  const pendingIdxRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await api.getNews(3);
        if (!alive) return;
        setNews(items);
        setNewsIdx(0);
      } catch {
        if (!alive) return;
        setNews([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // helper to change slide with fade
  function goToSlide(nextIndex: number) {
    if (!news.length) return;
    if (nextIndex === newsIdx) return;

    // if currently fading, just queue the newest requested index
    if (isFading) {
      pendingIdxRef.current = nextIndex;
      return;
    }

    setIsFading(true);

    // clear any existing timer
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

    fadeTimerRef.current = window.setTimeout(() => {
      setNewsIdx(nextIndex);
      setIsFading(false);

      // if something queued during fade, run it next
      const queued = pendingIdxRef.current;
      pendingIdxRef.current = null;
      if (queued !== null && queued !== nextIndex) {
        // slight next-tick so state settles
        window.setTimeout(() => goToSlide(queued), 0);
      }
    }, FADE_MS);
  }

  // auto-rotate every 10s (only if >1 story)
  useEffect(() => {
    if (news.length <= 1) return;

    const t = window.setInterval(() => {
      const next = (newsIdx + 1) % news.length;
      goToSlide(next);
    }, 10000);

    return () => window.clearInterval(t);
    // intentionally depend on newsIdx and news.length for correct next value
  }, [newsIdx, news.length]);

  // cleanup fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <SiteLayout active="home">
        <div className="panel">
          <div className="panel-body">Loading...</div>
        </div>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout active="home">
        <div className="panel">
          <div className="panel-body">
            <div className="muted">Not logged in.</div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const health = Number(user.health ?? 0);
  const maxHealth = Number(user.maxHealth ?? 0);
  const energy = Number(user.energy ?? 0);
  const maxEnergy = Number(user.maxEnergy ?? 0);

  const activeNews = news[newsIdx];

  return (
    <SiteLayout active="home">
      <div className="me-grid">
        {/* LEFT MAIN PANEL */}
        <section className="panel panel-main">
          <div className="panel-head">PROFILE</div>

          <div className="panel-body">
            <div className="panel-title">
              <div className="avatar-placeholder" />
              <div>
                <div className="me-name">{user.username}</div>
                <div className="me-sub">Level 0</div>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-label">Health</div>
                <div className="bar">
                  <div
                    className="bar-fill bar-fill--health"
                    style={{ width: `${pct(health, maxHealth)}%` }}
                  />
                </div>
                <div className="stat-value">
                  {health} / {maxHealth}
                </div>
              </div>

              <div className="stat">
                <div className="stat-label">Energy</div>
                <div className="bar">
                  <div
                    className="bar-fill bar-fill--energy"
                    style={{ width: `${pct(energy, maxEnergy)}%` }}
                  />
                </div>
                <div className="stat-value">
                  {energy} / {maxEnergy}
                </div>
              </div>
            </div>

            <div className="mini-stats">
              <div className="mini">
                K/D <br />
                <b>{Number((user as any).kd ?? 0).toFixed(2)}</b>
              </div>
              <div className="mini">
                Cash <br />
                <b>${Number((user as any).credits ?? 0).toLocaleString()}</b>
              </div>
              <div className="mini">
                Bank <br />
                <b>
                  ${Number((user as any).bank_amount ?? 0).toLocaleString()}
                </b>
              </div>
              <div className="mini">
                Account <br />
                <b>Standard</b>
              </div>
              <div className="mini">
                Rank <br />
                <b>{user.rank ?? "-"}</b>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <aside className="me-side">
          {/* NEWS */}
          <section className="panel panel-side">
            <div className="panel-head">NEWS</div>
            <div className="panel-body">
              {!activeNews ? (
                <div className="muted">No news yet.</div>
              ) : (
                <div className="news-card">
                  <div className="news-media">
                    <div
                      className={`news-fade ${isFading ? "is-fading" : ""}`}
                      style={{ transitionDuration: `${FADE_MS}ms` }}
                    >
                      <img
                        className="news-img"
                        src={activeNews.imageUrl}
                        alt={activeNews.title}
                        width={759}
                        height={300}
                        loading="lazy"
                      />

                      <div className="news-overlay">
                        <div className="news-overlay__inner">
                          <div className="news-title">{activeNews.title}</div>
                          <div className="news-desc">
                            {activeNews.description}
                          </div>
                          <div className="news-author">
                            by {activeNews.author}
                          </div>
                        </div>

                        {news.length > 1 && (
                          <div className="news-dots">
                            {news.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`news-dot ${i === newsIdx ? "active" : ""}`}
                                onClick={() => goToSlide(i)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary news-btn"
                    type="button"
                    onClick={() => nav(`/news/${activeNews.id}`)}
                  >
                    Read More
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* CORPORATION */}
          <section className="panel panel-side">
            <div className="panel-head">CORPORATION</div>
            <div className="panel-body">
              <div className="corp">
                <div className="corp-badge">N/A</div>
                <div>
                  <div className="corp-name">Unemployed</div>
                  <div className="muted">No rank</div>
                </div>
              </div>
            </div>
          </section>

          {/* DISCORD */}
          <section className="panel panel-side">
            <div className="panel-head">DISCORD</div>
            <div className="panel-body">
              <div className="discord-row">
                <div className="muted">
                  Link your Discord to get verified on our server.
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  type="button"
                >
                  Link Discord
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </SiteLayout>
  );
}

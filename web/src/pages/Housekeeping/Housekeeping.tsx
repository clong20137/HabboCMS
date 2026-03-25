import { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";

import HKLayout from "./HKLayout";

import HKDashboard from "./HKDashboard";
import HKUsers from "./HKUsers";
import HKWordFilter from "./HKWordFilter";
import HKBans from "./HKBans";
import HKSettings from "./HKSettings";
import HKAuditLog from "./HKAuditLog";
import HKAccessDenied from "./HKAcessDenied";

import HKNewsNew from "./HKNewsNew";
import HKNewsList from "./HKNewsList";
import HKNewsEdit from "./HKNewsEdit";
import { useHotelTitle } from "../../hooks/useHotelTitle";

import HKTicketsList from "./HKTicketsList";
import HKTicketView from "./HKTicketView";

import hkWordfilter from "../../assets/housekeeping/wordfilter.png";
import hkChatlog from "../../assets/housekeeping/chatlog.png";
import hkUsersIcon from "../../assets/housekeeping/id.gif";
import hkBansIcon from "../../assets/housekeeping/news.png";
import hkNewsIcon from "../../assets/housekeeping/news.png";
import hkSettingsIcon from "../../assets/navigation/setting.png";
import hkAuditIcon from "../../assets/navigation/audit.png";

import hkTicketsIcon from "../../assets/housekeeping/tickets.png";

import "../../styles/Housekeeping/housekeeping.scss";

type HKMeResponse = {
  ok: boolean;
  user?: { id: number; username: string; rank: number };
  permissions?: string[];
  message?: string;
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

type HKSubTab = { key: string; label: string; to: string; icon: string };

type HKTab = {
  key: string;
  label: string;
  to: string;
  icon: string;
  children?: HKSubTab[];
};

export default function Housekeeping() {
  useHotelTitle("Housekeeping Dashboard");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<HKMeResponse | null>(null);
  const [error, setError] = useState<string>("");

  const location = useLocation();

  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIsSwitching(true);

    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);

    switchTimerRef.current = window.setTimeout(() => {
      setIsSwitching(false);
    }, 180);

    return () => {
      if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    };
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiGet<HKMeResponse>("/api/hk/me");
        if (!mounted) return;
        setMe(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load housekeeping");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const allowed = useMemo(() => {
    const rank = Number(me?.user?.rank ?? 0);
    return rank >= 4;
  }, [me]);

  const perms = useMemo(
    () => new Set(me?.permissions || []),
    [me?.permissions],
  );
  const can = (p: string) => perms.has(p);

  const tabs: HKTab[] = useMemo(() => {
    const out: HKTab[] = [];

    out.push({
      key: "dash",
      label: "Dashboard",
      to: "/housekeeping",
      icon: hkChatlog,
    });

    if (can("hk.tickets.view")) {
      out.push({
        key: "tickets",
        label: "Tickets",
        to: "/housekeeping/tickets",
        icon: hkTicketsIcon,
      });
    }

    if (can("hk.user.view"))
      out.push({
        key: "users",
        label: "Users",
        to: "/housekeeping/users",
        icon: hkUsersIcon,
      });

    if (can("hk.bans.view"))
      out.push({
        key: "bans",
        label: "Bans",
        to: "/housekeeping/bans",
        icon: hkBansIcon,
      });


    if (can("hk.wordfilter.view"))
      out.push({
        key: "wordfilter",
        label: "Word Filter",
        to: "/housekeeping/wordfilter",
        icon: hkWordfilter,
      });

    if (can("hk.news.view"))
      out.push({
        key: "news",
        label: "News",
        to: "/housekeeping/news",
        icon: hkNewsIcon,
        children: [
          ...(can("hk.news.edit")
            ? [
                {
                  key: "news-new",
                  label: "New Article",
                  to: "/housekeeping/news/new",
                  icon: hkNewsIcon, // reuse
                },
              ]
            : []),
          {
            key: "news-list",
            label: "Edit Articles",
            to: "/housekeeping/news",
            icon: hkNewsIcon, // reuse
          },
        ],
      });

    if (can("hk.settings.view"))
      out.push({
        key: "settings",
        label: "Settings",
        to: "/housekeeping/settings",
        icon: hkSettingsIcon,
      });

    if (can("hk.audit.view"))
      out.push({
        key: "audit",
        label: "Audit Log",
        to: "/housekeeping/audit",
        icon: hkAuditIcon,
      });

    return out;
  }, [can]);

  if (loading) {
    return (
      <HKLayout>
        <div className="hk-wrap">
          <div className="hk-shell panel">
            <div className="panel-head">HOUSEKEEPING</div>
            <div className="panel-body hk-loading">Loading…</div>
          </div>
        </div>
      </HKLayout>
    );
  }

  if (error || !allowed) {
    return (
      <HKLayout>
        <div className="hk-wrap">
          <div className="hk-shell">
            <HKAccessDenied
              message={error || "You do not have access to Housekeeping."}
            />
          </div>
        </div>
      </HKLayout>
    );
  }

  const path = location.pathname;
  const isNewsSection = path.startsWith("/housekeeping/news");

  return (
    <HKLayout>
      <div className="hk-wrap">
        <div className="hk-shell hk-grid hk-grid--accountNav">
          {/* LEFT NAV */}
          <aside className="hk-nav panel">
            <div className="panel-head hk-nav-head">
              <div className="hk-nav-title">HOUSEKEEPING</div>
              <div className="hk-nav-sub">
                Logged in as <b>{me?.user?.username}</b> (Rank {me?.user?.rank})
              </div>
            </div>

            <div className="hk-nav-body hk-tabs__list">
              {tabs.map((t) => (
                <div key={t.key} className="hk-tabGroup">
                  
                  <NavLink
                    to={t.to}
                    end={t.to === "/housekeeping"}
                    className={({ isActive }) =>
                      `hk-tab ${isActive ? "active" : ""}`
                    }
                  >
                    <img className="hk-tab__icon" src={t.icon} alt="" />
                    <span className="hk-tab__label">{t.label}</span>
                  </NavLink>

                  
                  {t.key === "news" && t.children && isNewsSection && (
                    <div className="hk-subnav">
                      {t.children.map((c) => (
                        <NavLink
                          key={c.key}
                          to={c.to}
                          end={c.to === "/housekeeping/news"}
                          className={({ isActive }) =>
                            `hk-subtab ${isActive ? "active" : ""}`
                          }
                        >
                          <img
                            className="hk-subtab__icon"
                            src={c.icon}
                            alt=""
                          />
                          <span className="hk-subtab__label">{c.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT CONTENT */}
          <main className="hk-main">
            <div
              className={`hk-mainTransition ${
                isSwitching ? "is-switching" : "is-ready"
              }`}
            >
              <Routes>
                <Route path="/" element={<HKDashboard me={me!} />} />
                <Route path="/users" element={<HKUsers me={me!} />} />
                <Route path="/wordfilter" element={<HKWordFilter />} />
                <Route path="/bans" element={<HKBans />} />
                <Route path="/settings" element={<HKSettings me={me!} />} />
                <Route path="/audit" element={<HKAuditLog me={me!} />} />

                
                <Route path="/news" element={<HKNewsList />} />
                <Route path="/news/new" element={<HKNewsNew />} />
                <Route path="/news/edit/:id" element={<HKNewsEdit />} />

                
                <Route path="/tickets" element={<HKTicketsList />} />
                <Route path="/tickets/:id" element={<HKTicketView />} />

                <Route
                  path="*"
                  element={<Navigate to="/housekeeping" replace />}
                />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </HKLayout>
  );
}

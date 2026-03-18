import { useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

import habboLogo from "../../assets/habbo.png";
import headerBg from "../../assets/bg.png";
import spaceBg from "../../assets/bgspace.gif";

import navHome from "../../assets/navigation/home.png";
import navSetting from "../../assets/navigation/setting.png";
import navStaff from "../../assets/navigation/staff.png";
import navEdit from "../../assets/navigation/edit.png";
import hkBansIcon from "../../assets/housekeeping/edit.png";
import logoutIcon from "../../assets/navigation/logout.gif";
import InlineColorPicker from "../../components/theme/InlineColorPicker";

import {
  DEFAULT_THEME,
  darken,
  isValidHex,
  normalizeTheme,
  readableText,
} from "../../theme/themeUtils";
import type { ThemeState } from "../../theme/themeUtils";

type Props = PropsWithChildren<{}>;

type OpenMenu = null | "account" | "theme";

type ThemeTab = "primary" | "secondary";

const THEME_KEY = "plus_theme_v1";

function applyThemeVars(t: ThemeState) {
  const root = document.documentElement;

  const primary = t.primary || DEFAULT_THEME.primary;
  const secondary = t.secondary || DEFAULT_THEME.secondary;
  const footer = primary;

  root.style.setProperty("--primary-color", primary);
  root.style.setProperty("--primary-dark", darken(primary, 0.18));
  root.style.setProperty("--on-primary", readableText(primary));

  root.style.setProperty("--secondary-color", secondary);
  root.style.setProperty("--secondary-dark", darken(secondary, 0.18));
  root.style.setProperty("--on-secondary", readableText(secondary));

  root.style.setProperty("--footer-color", footer);
  root.style.setProperty("--footer-dark", darken(footer, 0.18));
  root.style.setProperty("--on-footer", readableText(footer));
}

function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) throw new Error("no theme");
    return normalizeTheme(JSON.parse(raw));
  } catch {
    return DEFAULT_THEME;
  }
}

function saveTheme(t: ThemeState) {
  localStorage.setItem(THEME_KEY, JSON.stringify(normalizeTheme(t)));
}

type HKMe = {
  ok: boolean;
  user?: { id: number; username: string; rank: number };
  permissions?: string[];
  error?: string;
};

export default function HKLayout({ children }: Props) {
  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [online, setOnline] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());
  const [themeTab, setThemeTab] = useState<ThemeTab>("primary");

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [hk, setHk] = useState<HKMe | null>(null);
  const [hkLoading, setHkLoading] = useState(true);

  const isLoggedIn = !!user;

  useEffect(() => {
    applyThemeVars(theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => setOpenMenu(null), [location.pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function loadOnlineCount() {
      try {
        const res = await api.onlineCount();
        setOnline(Number(res?.online ?? 0));
      } catch {
        setOnline(null);
      }
    }

    loadOnlineCount();
    timer = setInterval(loadOnlineCount, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadHKMe() {
      setHkLoading(true);
      try {
        const res = await fetch("/api/hk/me", { credentials: "include" });
        const data = (await res.json()) as HKMe;
        if (!mounted) return;

        if (!res.ok || !data?.ok) {
          setHk({ ok: false, error: data?.error || "Access denied." });
        } else {
          setHk(data);
        }
      } catch (e: unknown) {
        if (!mounted) return;
        const message =
          e instanceof Error ? e.message : "Failed to load HK access.";
        setHk({ ok: false, error: message });
      } finally {
        if (mounted) setHkLoading(false);
      }
    }

    if (isLoggedIn) loadHKMe();
    else {
      setHkLoading(false);
      setHk({ ok: false, error: "Not logged in." });
    }

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const perms = useMemo(
    () => new Set(hk?.permissions || []),
    [hk?.permissions],
  );
  const can = (p: string) => perms.has(p);

  const onlineText = useMemo(() => {
    if (online === null) return "— Online";
    return `${online} Citizen(s) Online`;
  }, [online]);

  async function doLogout() {
    try {
      await logout();
    } finally {
      nav("/login");
    }
  }

  function toggleMenu(name: OpenMenu) {
    if (!isLoggedIn && name === "account") return;
    setOpenMenu((prev) => (prev === name ? null : name));
  }

  function updateThemeValue(key: "primary" | "secondary", value: string) {
    const v = String(value || "").trim();
    setTheme((prev) =>
      normalizeTheme({
        ...prev,
        [key]: isValidHex(v) ? v : prev[key],
      }),
    );
  }

  function updateThemeHex(key: "primary" | "secondary", value: string) {
    const v = String(value || "").trim();
    if (!v) return;

    if (!v.startsWith("#")) {
      const candidate = `#${v.replace(/^#+/, "")}`;
      if (isValidHex(candidate)) updateThemeValue(key, candidate);
      return;
    }

    if (isValidHex(v)) updateThemeValue(key, v);
  }

  const activeKey: "primary" | "secondary" =
    themeTab === "primary" ? "primary" : "secondary";

  return (
    <div className="site site--hk" ref={wrapRef}>
      <header
        className="site-header"
        style={{ backgroundImage: `url(${headerBg})` }}
      >
        <div className="site-header__inner">
          <Link
            to="/housekeeping"
            className="brand"
            aria-label="Housekeeping Home"
          >
            <img className="brand__logo-img" src={habboLogo} alt="Habbo" />
          </Link>

          <div className="header-actions header-actions--stack">
            <div className="online-pill online-pill--float">
              <span className="dot" />
              <span className="online-text">{onlineText}</span>
            </div>

            <Link to="/me" className="btn btn-primary btn-enter">
              Back to Site
            </Link>
          </div>
        </div>
      </header>

      <nav className="site-nav site-nav--secondary-gradient">
        <div className="site-nav__inner">
          <div className="nav-left">
            <Link
              className={`nav-item ${location.pathname === "/housekeeping" ? "active" : ""}`}
              to="/housekeeping"
            >
              <img className="nav-ico" src={navHome} alt="" />
              Dashboard
            </Link>

            {can("hk.wordfilter.view") && (
              <Link
                className={`nav-item ${location.pathname.includes("/housekeeping/wordfilter") ? "active" : ""}`}
                to="/housekeeping/wordfilter"
              >
                <img className="nav-ico" src={navStaff} alt="" />
                Word Filter
              </Link>
            )}

            {can("hk.user.view") && (
              <Link
                className={`nav-item ${location.pathname.includes("/housekeeping/users") ? "active" : ""}`}
                to="/housekeeping/users"
              >
                <img className="nav-ico" src={navStaff} alt="" />
                Users
              </Link>
            )}

            {can("hk.bans.view") && (
              <Link
                className={`nav-item ${location.pathname.includes("/housekeeping/bans") ? "active" : ""}`}
                to="/housekeeping/bans"
              >
                <img className="nav-ico" src={hkBansIcon} alt="" />
                Bans
              </Link>
            )}
          </div>

          <div className="nav-right">
            <div
              className={`nav-dropdown ${openMenu === "theme" ? "open" : ""}`}
            >
              <button
                type="button"
                className="icon-btn"
                onClick={() => toggleMenu("theme")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "theme"}
                title="Theme"
              >
                <img src={navEdit} alt="" className="icon-img" />
              </button>

              <div
                className="dropdown-menu dropdown-menu--right theme-menu"
                role="menu"
              >
                <div className="theme-tabs">
                  <button
                    className={`theme-tab ${themeTab === "primary" ? "active" : ""}`}
                    onClick={() => setThemeTab("primary")}
                    type="button"
                  >
                    Primary
                  </button>
                  <button
                    className={`theme-tab ${themeTab === "secondary" ? "active" : ""}`}
                    onClick={() => setThemeTab("secondary")}
                    type="button"
                  >
                    Secondary
                  </button>
                </div>

                <div className="theme-picker-v2-wrap">
                  <InlineColorPicker
                    value={theme[activeKey]}
                    onChange={(hex) => updateThemeValue(activeKey, hex)}
                  />

                  <div className="theme-hexrow theme-hexrow--v2">
                    <input
                      className="theme-hex theme-hex--pro"
                      value={theme[activeKey]}
                      onChange={(e) =>
                        updateThemeHex(activeKey, e.target.value)
                      }
                      placeholder="#RRGGBB"
                      spellCheck={false}
                    />
                    <div
                      className="theme-swatch"
                      style={{ background: theme[activeKey] }}
                      title="Preview"
                    />
                  </div>

                  <div className="theme-actions">
                    <button
                      type="button"
                      className="theme-action"
                      onClick={() => setTheme(loadTheme())}
                      title="Reset to saved"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="theme-action"
                      onClick={() => setTheme(DEFAULT_THEME)}
                      title="Reset to default"
                    >
                      ⟲
                    </button>
                  </div>

                  <div className="theme-hint">
                    <b>Live preview:</b> primary updates the footer
                    automatically.
                  </div>
                </div>
              </div>
            </div>

            {isLoggedIn && (
              <div
                className={`nav-dropdown ${openMenu === "account" ? "open" : ""}`}
              >
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => toggleMenu("account")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "account"}
                  title={user ? user.username : "Account"}
                >
                  <img className="dropdown-ico" src={navSetting} alt="" />
                </button>

                <div className="dropdown-menu dropdown-menu--right" role="menu">
                  <Link className="dropdown-item" to="/me" role="menuitem">
                    <img className="dropdown-ico" src={navHome} alt="" />
                    Back to Site
                  </Link>

                  <div className="dropdown-sep" />

                  <button
                    className="dropdown-item dropdown-item--danger"
                    onClick={doLogout}
                    role="menuitem"
                    type="button"
                  >
                    <img className="dropdown-ico" src={logoutIcon} alt="" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main
        className="site-content"
        style={{ backgroundImage: `url(${spaceBg})` }}
      >
        <div className="site-content__inner">
          {hkLoading ? (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Housekeeping</div>
              </div>
              <div className="panel-body">Loading access…</div>
            </div>
          ) : !hk?.ok ? (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Access Denied</div>
              </div>
              <div className="panel-body">
                <p>
                  {hk?.error ||
                    "You do not have permission to access housekeeping."}
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <Link to="/me" className="btn btn-primary">
                    Go Home
                  </Link>
                  <Link to="/client" className="btn">
                    Open Client
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            © {new Date().getFullYear()} PlusCMS • not for profit educational
            project
          </div>
          <div className="muted">Housekeeping</div>
        </div>
      </footer>
    </div>
  );
}

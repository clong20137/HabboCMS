import { useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

import habboLogo from "../../assets/habbo.png";
import headerBg from "../../assets/bg.png";
import spaceBg from "../../assets/bgspace.gif";

import navHome from "../../assets/navigation/home.png";
import navCommunity from "../../assets/navigation/community.png";
import navStore from "../../assets/navigation/diamonds.png";
import navLeaderboards from "../../assets/navigation/leaderboards.png";
import navSetting from "../../assets/navigation/setting.png";
import navStaff from "../../assets/navigation/staff.png";
import navEdit from "../../assets/navigation/edit.png";

import ticketsIcon from "../../assets/navigation/tickets.png";
import logoutIcon from "../../assets/navigation/logout.gif";
import InlineColorPicker from "../theme/InlineColorPicker";
import {
  DEFAULT_THEME,
  darken,
  isValidHex,
  normalizeTheme,
  readableText,
} from "../../theme/themeUtils";
import type { ThemeState } from "../../theme/themeUtils";
import { useClientDock } from "../../pages/ClientDock";

type Props = PropsWithChildren<{
  active?: "home" | "community" | "store" | "me" | "support";
}>;

type OpenMenu = null | "community" | "account" | "theme";
type ThemeTab = "primary" | "secondary";

const THEME_KEY = "plus_theme_v1";

function applyThemeVars(t: ThemeState) {
  const root = document.documentElement;

  const themePrimary = t.primary || DEFAULT_THEME.primary;
  const themeSecondary = t.secondary || DEFAULT_THEME.secondary;
  const footer = themePrimary;

  const primary = themeSecondary;
  const secondary = themePrimary;

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

export default function SiteLayout({ children, active = "home" }: Props) {
  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const dock = useClientDock();

  const [online, setOnline] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());
  const [themeTab, setThemeTab] = useState<ThemeTab>("primary");

  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const activeKey: "primary" | "secondary" =
    themeTab === "primary" ? "primary" : "secondary";

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
      if (isValidHex(candidate)) {
        updateThemeValue(key, candidate);
      }
      return;
    }

    if (isValidHex(v)) updateThemeValue(key, v);
  }

  function resetToSaved() {
    setTheme(loadTheme());
  }

  function resetDefault() {
    setTheme(DEFAULT_THEME);
  }

  return (
    <div className="site" ref={wrapRef}>
      <header
        className="site-header"
        style={{ backgroundImage: `url(${headerBg})` }}
      >
        <div className="site-header__inner">
          <Link
            to={isLoggedIn ? "/me" : "/"}
            className="brand"
            aria-label="Home"
          >
            <img className="brand__logo-img" src={habboLogo} alt="Habbo" />
          </Link>

          <div className="header-actions header-actions--stack">
            <div className="online-pill online-pill--float">
              <span className="dot" />
              <span className="online-text">{onlineText}</span>
            </div>

            {isLoggedIn ? (
              <button
                type="button"
                className="btn btn-primary btn-enter"
                onClick={() => dock.openDock()}
              >
                Enter Client
              </button>
            ) : (
              <Link to="/register" className="btn btn-primary btn-enter">
                Register
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="site-nav site-nav--secondary-gradient">
        <div className="site-nav__inner">
          <div className="nav-left">
            <Link
              className={`nav-item ${active === "home" ? "active" : ""}`}
              to={isLoggedIn ? "/me" : "/"}
            >
              <img className="nav-ico" src={navHome} alt="" />
              Home
            </Link>

            <div
              className={`nav-dropdown ${openMenu === "community" ? "open" : ""}`}
            >
              <button
                type="button"
                className={`nav-item nav-item--btn ${active === "community" ? "active" : ""}`}
                onClick={() => toggleMenu("community")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "community"}
              >
                <img className="nav-ico" src={navCommunity} alt="" />
                Community <span className="chev">▾</span>
              </button>

              <div className="dropdown-menu" role="menu">
                <Link className="dropdown-item" to="/staff" role="menuitem">
                  <img className="dropdown-ico" src={navStaff} alt="" />
                  Staff Team
                </Link>

                <Link
                  className="dropdown-item"
                  to="/leaderboards"
                  role="menuitem"
                >
                  <img className="dropdown-ico" src={navLeaderboards} alt="" />
                  Leaderboards
                </Link>
              </div>
            </div>

            <Link
              className={`nav-item ${active === "store" ? "active" : ""}`}
              to="/store"
            >
              <img className="nav-ico" src={navStore} alt="" />
              Store
            </Link>
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
                      title="Reset to saved"
                      onClick={resetToSaved}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="theme-action"
                      title="Reset to defaults"
                      onClick={resetDefault}
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
                  <Link className="dropdown-item" to="/account" role="menuitem">
                    <img className="dropdown-ico" src={navSetting} alt="" />
                    Account Settings
                  </Link>

                  <Link className="dropdown-item" to="/tickets" role="menuitem">
                    <img className="dropdown-ico" src={ticketsIcon} alt="" />
                    Tickets
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
        <div className="site-content__inner">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            © {new Date().getFullYear()} PlusCMS • not for profit educational
            project
          </div>
          <div className="muted">Version 1.0 Beta</div>
        </div>
      </footer>
    </div>
  );
}

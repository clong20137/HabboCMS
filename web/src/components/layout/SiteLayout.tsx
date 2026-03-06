import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

import habboLogo from "../../assets/habbo.png";
import headerBg from "../../assets/bg.png";
import spaceBg from "../../assets/bgspace.gif";

// Nav icons
import navHome from "../../assets/navigation/home.png";
import navCommunity from "../../assets/navigation/community.png";
import navStore from "../../assets/navigation/diamonds.png";
import navLeaderboards from "../../assets/navigation/leaderboards.png";
import navSetting from "../../assets/navigation/setting.png";
import navStaff from "../../assets/navigation/staff.png";
import navEdit from "../../assets/navigation/edit.png";

// Dropdown icons
import ticketsIcon from "../../assets/navigation/tickets.png";
import logoutIcon from "../../assets/navigation/logout.gif";

type Props = PropsWithChildren<{
  active?: "home" | "community" | "store" | "me" | "support";
}>;

type OpenMenu = null | "community" | "account" | "theme";
type ThemeTab = "primary" | "secondary" | "footer";

type ThemeState = {
  primary: string;
  secondary: string;
  footer: string;
};

const THEME_KEY = "plus_theme_v1";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) =>
    clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function darken(hex: string, pct: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = 1 - clamp(pct, 0, 0.9);
  return rgbToHex(rgb.r * f, rgb.g * f, rgb.b * f);
}

function readableText(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.55 ? "#0b0f14" : "#ffffff";
}

function applyThemeVars(t: ThemeState) {
  const root = document.documentElement;

  const themePrimary = t.primary || "#6f7b86";
  const themeSecondary = t.secondary || "#2a2f36";
  const footer = t.footer || "#1b2026";

  const primary = themeSecondary; // headers/buttons/etc
  const secondary = themePrimary; // everything else

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
    const parsed = JSON.parse(raw);
    return {
      primary: String(parsed.primary || "#6f7b86"),
      secondary: String(parsed.secondary || "#2a2f36"),
      footer: String(parsed.footer || "#1b2026"),
    };
  } catch {
    return { primary: "#6f7b86", secondary: "#2a2f36", footer: "#1b2026" };
  }
}

function saveTheme(t: ThemeState) {
  localStorage.setItem(THEME_KEY, JSON.stringify(t));
}

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(String(v || "").trim());
}

export default function SiteLayout({ children, active = "home" }: Props) {
  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [online, setOnline] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());
  const [themeTab, setThemeTab] = useState<ThemeTab>("primary");

  // draft values (so you can hit “Save Colors” like the screenshot)
  const [draft, setDraft] = useState<ThemeState>(() => loadTheme());

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isLoggedIn = !!user;

  // Apply theme whenever SAVED theme changes
  useEffect(() => {
    applyThemeVars(theme);
    saveTheme(theme);
  }, [theme]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Close dropdowns on route change
  useEffect(() => setOpenMenu(null), [location.pathname]);

  // Online count polling
  useEffect(() => {
    let timer: any;

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

    // when opening theme menu, sync draft to current saved theme
    if (name === "theme") setDraft(theme);
  }

  const activeKey: keyof ThemeState =
    themeTab === "primary"
      ? "primary"
      : themeTab === "secondary"
        ? "secondary"
        : "footer";

  function setDraftValue(key: keyof ThemeState, value: string) {
    const v = String(value || "").trim();

    // allow typing partials in hex input, but only commit to color picker if valid
    setDraft((prev) => ({ ...prev, [key]: v }));
  }

  function applySaved() {
    // sanitize
    const next: ThemeState = {
      primary: isValidHex(draft.primary) ? draft.primary : "#6f7b86",
      secondary: isValidHex(draft.secondary) ? draft.secondary : "#2a2f36",
      footer: isValidHex(draft.footer) ? draft.footer : "#1b2026",
    };
    setTheme(next);
  }

  function resetToSaved() {
    setDraft(loadTheme());
  }

  function resetDefault() {
    setDraft({ primary: "#6f7b86", secondary: "#2a2f36", footer: "#1b2026" });
  }

  return (
    <div className="site" ref={wrapRef}>
      {/* HEADER */}
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
              <Link to="/client" className="btn btn-primary btn-enter">
                Enter Client
              </Link>
            ) : (
              <Link to="/register" className="btn btn-primary btn-enter">
                Register
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* NAV */}
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
            {/* THEME EDITOR */}
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
                {/* Tabs like screenshot */}
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
                  <button
                    className={`theme-tab ${themeTab === "footer" ? "active" : ""}`}
                    onClick={() => setThemeTab("footer")}
                    type="button"
                  >
                    Footer
                  </button>
                </div>

                {/* Big picker block */}
                <div className="theme-picker theme-picker--pro">
                  <div className="theme-picker__box">
                    <input
                      className="theme-color theme-color--big"
                      type="color"
                      value={
                        isValidHex(draft[activeKey])
                          ? draft[activeKey]
                          : "#000000"
                      }
                      onChange={(e) => setDraftValue(activeKey, e.target.value)}
                      aria-label="Pick color"
                    />
                  </div>

                  {/* Hex row */}
                  <div className="theme-hexrow">
                    <input
                      className="theme-hex theme-hex--pro"
                      value={draft[activeKey]}
                      onChange={(e) => setDraftValue(activeKey, e.target.value)}
                      placeholder="#RRGGBB"
                      spellCheck={false}
                    />
                    <div
                      className="theme-swatch"
                      style={{
                        background: isValidHex(draft[activeKey])
                          ? draft[activeKey]
                          : "#000",
                      }}
                      title="Preview"
                    />
                  </div>

                  {/* Action buttons row (icons) */}
                  <div className="theme-actions">
                    <button
                      type="button"
                      className="theme-action"
                      title="Reset (from saved)"
                      onClick={resetToSaved}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="theme-action"
                      title="Reset (default)"
                      onClick={resetDefault}
                    >
                      ⟲
                    </button>
                    <button
                      type="button"
                      className="theme-action theme-action--danger"
                      title="Clear"
                      onClick={() => setDraftValue(activeKey, "#000000")}
                    >
                      🗑
                    </button>
                  </div>

                  {/* Save Colors button */}
                  <button
                    type="button"
                    className="btn btn-primary theme-save"
                    onClick={applySaved}
                    disabled={!isValidHex(draft[activeKey])}
                    title={
                      !isValidHex(draft[activeKey])
                        ? "Enter a valid hex color"
                        : "Save Colors"
                    }
                  >
                    Save Colors
                  </button>

                  {/* tiny hint for the swap */}
                  <div className="theme-hint">
                    <b>Primary</b> controls header/buttons • <b>Secondary</b>{" "}
                    controls the rest
                  </div>
                </div>
              </div>
            </div>

            {/* ACCOUNT DROPDOWN */}
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

      {/* CONTENT */}
      <main
        className="site-content"
        style={{ backgroundImage: `url(${spaceBg})` }}
      >
        <div className="site-content__inner">{children}</div>
      </main>

      {/* FOOTER */}
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

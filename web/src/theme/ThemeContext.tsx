import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeColors = {
  primary: string;
  secondary: string;
  footer: string;
};

type ThemeCtx = {
  colors: ThemeColors;
  setColors: (next: Partial<ThemeColors>) => void;
  reset: () => void;

  // computed for readability
  onPrimary: string;
  onSecondary: string;
  onFooter: string;

  primaryDark: string;
  secondaryDark: string;
  footerDark: string;
};

const STORAGE_KEY = "plus_theme_v1";

const DEFAULTS: ThemeColors = {
  // neutral defaults (NOT gold)
  primary: "#3b82f6", // blue-ish default (can change in UI)
  secondary: "#2a2f36", // dark neutral for bars/headers
  footer: "#1f2329", // footer neutral
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgb(hex: string) {
  const v = hex.replace("#", "").trim();
  if (v.length === 3) {
    const r = parseInt(v[0] + v[0], 16);
    const g = parseInt(v[1] + v[1], 16);
    const b = parseInt(v[2] + v[2], 16);
    return { r, g, b };
  }
  if (v.length === 6) {
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
}

// Relative luminance
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function autoText(hexBg: string) {
  // simple and reliable: white text on dark backgrounds, black on light
  return luminance(hexBg) > 0.55 ? "#0b0f14" : "#ffffff";
}

function mix(hexA: string, hexB: string, t: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const b2 = Math.round(a.b + (b.b - a.b) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(clamp(r, 0, 255))}${toHex(clamp(g, 0, 255))}${toHex(clamp(b2, 0, 255))}`;
}

function darken(hex: string, amt = 0.18) {
  // mix towards black
  return mix(hex, "#000000", clamp(amt, 0, 1));
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setState] = useState<ThemeColors>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.primary && parsed?.secondary && parsed?.footer) {
          setState({
            primary: String(parsed.primary),
            secondary: String(parsed.secondary),
            footer: String(parsed.footer),
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const api = useMemo(() => {
    const primaryDark = darken(colors.primary, 0.18);
    const secondaryDark = darken(colors.secondary, 0.14);
    const footerDark = darken(colors.footer, 0.16);

    const onPrimary = autoText(colors.primary);
    const onSecondary = autoText(colors.secondary);
    const onFooter = autoText(colors.footer);

    // apply CSS variables globally
    const applyVars = () => {
      const root = document.documentElement;
      root.style.setProperty("--primary-color", colors.primary);
      root.style.setProperty("--primary-dark", primaryDark);
      root.style.setProperty("--on-primary", onPrimary);

      root.style.setProperty("--secondary-color", colors.secondary);
      root.style.setProperty("--secondary-dark", secondaryDark);
      root.style.setProperty("--on-secondary", onSecondary);

      root.style.setProperty("--footer-color", colors.footer);
      root.style.setProperty("--footer-dark", footerDark);
      root.style.setProperty("--on-footer", onFooter);
    };

    return {
      colors,
      setColors: (next: Partial<ThemeColors>) => {
        setState((prev) => {
          const merged = { ...prev, ...next };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      },
      reset: () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
        setState(DEFAULTS);
      },
      onPrimary,
      onSecondary,
      onFooter,
      primaryDark,
      secondaryDark,
      footerDark,
      applyVars,
    };
  }, [colors]);

  useEffect(() => {
    api.applyVars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.colors]);

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

export type ThemeState = {
  primary: string;
  secondary: string;
  footer: string;
};

export const DEFAULT_THEME: ThemeState = {
  primary: "#6f7b86",
  secondary: "#2a2f36",
  footer: "#6f7b86",
};

export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(String(v || "").trim());
}

export function normalizeTheme(input: Partial<ThemeState> | null | undefined): ThemeState {
  const primary = isValidHex(String(input?.primary || ""))
    ? String(input?.primary)
    : DEFAULT_THEME.primary;
  const secondary = isValidHex(String(input?.secondary || ""))
    ? String(input?.secondary)
    : DEFAULT_THEME.secondary;

  return {
    primary,
    secondary,
    footer: primary,
  };
}

export function hexToRgb(hex: string) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function darken(hex: string, pct: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = 1 - clamp(pct, 0, 0.9);
  return rgbToHex(rgb.r * f, rgb.g * f, rgb.b * f);
}

export function readableText(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.55 ? "#0b0f14" : "#ffffff";
}

export function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

export function hexToHsv(hex: string) {
  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_THEME.primary)!;
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export function hsvToRgb(h: number, s: number, v: number) {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (hh < 60) [rn, gn, bn] = [c, x, 0];
  else if (hh < 120) [rn, gn, bn] = [x, c, 0];
  else if (hh < 180) [rn, gn, bn] = [0, c, x];
  else if (hh < 240) [rn, gn, bn] = [0, x, c];
  else if (hh < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

export function hsvToHex(h: number, s: number, v: number) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

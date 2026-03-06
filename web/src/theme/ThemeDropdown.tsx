import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";

export default function ThemeDropdown() {
  const { colors, setColors, reset } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="theme" ref={ref}>
      <button
        type="button"
        className="theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="theme-gear" aria-hidden />
        <span className="theme-caret" aria-hidden />
      </button>

      {open && (
        <div className="theme-menu">
          <div className="theme-row">
            <div className="theme-label">Primary</div>
            <input
              className="theme-color"
              type="color"
              value={colors.primary}
              onChange={(e) => setColors({ primary: e.target.value })}
            />
            <input
              className="theme-hex"
              value={colors.primary}
              onChange={(e) => setColors({ primary: e.target.value })}
            />
          </div>

          <div className="theme-row">
            <div className="theme-label">Secondary</div>
            <input
              className="theme-color"
              type="color"
              value={colors.secondary}
              onChange={(e) => setColors({ secondary: e.target.value })}
            />
            <input
              className="theme-hex"
              value={colors.secondary}
              onChange={(e) => setColors({ secondary: e.target.value })}
            />
          </div>

          <div className="theme-row">
            <div className="theme-label">Footer</div>
            <input
              className="theme-color"
              type="color"
              value={colors.footer}
              onChange={(e) => setColors({ footer: e.target.value })}
            />
            <input
              className="theme-hex"
              value={colors.footer}
              onChange={(e) => setColors({ footer: e.target.value })}
            />
          </div>

          <div className="theme-actions">
            <button className="btn btn-secondary" onClick={reset} type="button">
              Reset
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            Auto-contrast is applied to text/icons.
          </div>
        </div>
      )}
    </div>
  );
}

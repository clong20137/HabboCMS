import React, { useEffect, useMemo, useRef } from "react";
import { clamp, hexToHsv, hsvToHex } from "../../theme/themeUtils";

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

export default function InlineColorPicker({ value, onChange }: Props) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const hsv = useMemo(() => hexToHsv(value), [value]);
  const pureHue = useMemo(() => hsvToHex(hsv.h, 1, 1), [hsv.h]);

  function updateFromArea(clientX: number, clientY: number) {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    onChange(hsvToHex(hsv.h, x, 1 - y));
  }

  function updateFromHue(clientX: number) {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    onChange(hsvToHex(x * 360, hsv.s, hsv.v));
  }

  function bindDrag(
    startEvent: React.MouseEvent<HTMLDivElement>,
    updater: (clientX: number, clientY: number) => void,
  ) {
    startEvent.preventDefault();
    updater(startEvent.clientX, startEvent.clientY);

    const onMove = (event: MouseEvent) => updater(event.clientX, event.clientY);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    return () => {
      window.onmousemove = null;
      window.onmouseup = null;
    };
  }, []);

  return (
    <div className="theme-picker-v2">
      <div
        ref={areaRef}
        className="theme-picker-v2__area"
        style={{ backgroundColor: pureHue }}
        onMouseDown={(e) => bindDrag(e, updateFromArea)}
      >
        <div className="theme-picker-v2__white" />
        <div className="theme-picker-v2__black" />
        <div
          className="theme-picker-v2__area-thumb"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        className="theme-picker-v2__hue"
        onMouseDown={(e) => bindDrag(e, (x) => updateFromHue(x))}
      >
        <div
          className="theme-picker-v2__hue-thumb"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>
    </div>
  );
}

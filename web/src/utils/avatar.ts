const AVATAR_IMAGER_BASE = "https://imager.olympusrp.pw/";
const DEFAULT_FIGURE =
  "hr-115-42.hd-195-19.ch-3030-82.lg-275-1408.fa-1201.ca-1804-64";

function cleanFigure(value?: string | null) {
  const raw = String(value || "").trim();
  return raw || DEFAULT_FIGURE;
}

export function getAvatarUrl(
  figure?: string | null,
  options?: {
    direction?: number;
    headDirection?: number;
    gesture?: string;
    size?: "s" | "m" | "l";
    headOnly?: boolean;
  },
) {
  const params = new URLSearchParams({
    figure: cleanFigure(figure),
    direction: String(options?.direction ?? 2),
    head_direction: String(options?.headDirection ?? 2),
  });

  // HEAD ONLY (Staff, Leaderboards, etc.)
if (options?.headOnly) {
  params.set("headonly", "1");
  params.set("size", options?.size ?? "l"); // 👈 FORCE LARGE
}
// FULL BODY (Me page)
else {
  params.set("gesture", options?.gesture ?? "sml");

  if (options?.size) {
    params.set("size", options.size);
  }
}

  return `${AVATAR_IMAGER_BASE}?${params.toString()}`;
}

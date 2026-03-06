export function clampInt(n: any, min: number, max: number, fallback: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.trunc(num), min), max);
}

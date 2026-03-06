export function toNewsImageUrl(imageFile: string | null | undefined) {
  const file = String(imageFile || "").trim();
  if (!file) return "";
  return `/assets/news/${file}`;
}

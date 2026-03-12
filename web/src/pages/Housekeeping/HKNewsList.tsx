import { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";
import { Link } from "react-router-dom";
import { useToast } from "../../ui/toast/ToastContext";

import editIcon from "../../assets/housekeeping/edit.png";
import deleteIcon from "../../assets/housekeeping/delete.png";

type NewsItem = {
  id: number;
  title: string;
  description: string;
  story: string;
  storyHtml: string;
  imageUrl?: string;
  image?: string;
  imagePath?: string;
  author: string;
  createdAt: string;
};

type ListResponse = {
  ok: boolean;
  total: number;
  items: NewsItem[];
  error?: string;
};

async function hkFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const method = String(opts?.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    return hkRequest<T>(url.replace(/^\/api/, ""), opts);
  }

  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as any)?.error || (data as any)?.message || "Request failed",
    );
  }
  return data as T;
}

function snippet(s: string, n: number) {
  const t = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? t.slice(0, n).trim() + "…" : t;
}

const APP_BASE =
  (import.meta as any).env?.BASE_URL || (process as any).env?.PUBLIC_URL || "/";

function withBase(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const u = url.startsWith("/") ? url : `/${url}`;
  const b = APP_BASE.endsWith("/") ? APP_BASE.slice(0, -1) : APP_BASE;
  return `${b}${u}`;
}

const newsImageModules = import.meta.glob(
  "../../assets/news/*.{png,jpg,jpeg,gif,webp,avif,svg}",
  {
    eager: true,
    import: "default",
  },
) as Record<string, string>;

const newsImageMap: Record<string, string> = Object.fromEntries(
  Object.entries(newsImageModules).map(([fullPath, url]) => {
    const fileName = fullPath.split("/").pop() || fullPath;
    return [fileName.toLowerCase(), url];
  }),
);

function resolveNewsImageSrc(n: NewsItem) {
  const raw =
    (n.imageUrl && n.imageUrl.trim()) ||
    (n.image && n.image.trim()) ||
    (n.imagePath && n.imagePath.trim()) ||
    "";

  if (!raw) return "";

  if (
    /^(https?:)?\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const normalized = raw.replace(/\\/g, "/").trim();
  const fileName =
    normalized.split("/").pop()?.toLowerCase() || normalized.toLowerCase();

  if (newsImageMap[fileName]) return newsImageMap[fileName];

  if (normalized.startsWith("/assets/news/")) return withBase(normalized);
  if (normalized.startsWith("assets/news/")) return withBase(`/${normalized}`);
  if (normalized.startsWith("/src/assets/news/"))
    return withBase(normalized.replace("/src", ""));
  if (normalized.startsWith("src/assets/news/")) {
    return withBase(`/${normalized.replace(/^src\//, "")}`);
  }

  return withBase(`/assets/news/${fileName}`);
}

export default function HKNewsList() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [limit] = useState(12);
  const [offset, setOffset] = useState(0);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));

      const data = await hkFetch<ListResponse>(`/api/hk/news?${qs.toString()}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setError(e?.message || "Failed to load news.");
      showToast(e?.message || "Failed to load news.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [offset]);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      load();
    }, 250);

    return () => clearTimeout(t);
  }, [search]);

  async function doDelete(id: number) {
    if (!confirm("Delete this article?")) return;

    try {
      await hkFetch(`/api/hk/news/${id}`, { method: "DELETE" });
      await load();
      showToast("Article deleted successfully.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to delete article.", "error");
    }
  }

  return (
    <div className="panel hk-news">
      <div className="panel-head">Edit Articles</div>

      <div className="panel-body">
        <div className="hk-news__searchRow">
          <input
            className="hk-input hk-news__search"
            placeholder="Search title, description, author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <div className="hk-alert hk-alert--error">{error}</div>}

        {loading ? (
          <div className="hk-loading">Loading…</div>
        ) : !items.length ? (
          <div style={{ fontWeight: 900, opacity: 0.9 }}>No results.</div>
        ) : (
          <div className="hk-newsCards">
            {items.map((n) => (
              <div key={n.id} className="hk-newsCard">
                <div className="hk-newsCard__thumb">
                  {resolveNewsImageSrc(n) ? (
                    <img
                      src={resolveNewsImageSrc(n)}
                      alt={n.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="hk-newsCard__image hk-newsCard__image--empty">
                      No Image
                    </div>
                  )}

                  <div className="hk-newsCard__overlay">
                    <Link
                      className="hk-newsCard__iconBtn"
                      to={`/housekeeping/news/edit/${n.id}`}
                      title="Edit"
                    >
                      <img src={editIcon} alt="Edit" />
                    </Link>

                    <button
                      className="hk-newsCard__iconBtn"
                      type="button"
                      title="Delete"
                      onClick={() => doDelete(n.id)}
                    >
                      <img src={deleteIcon} alt="Delete" />
                    </button>
                  </div>
                </div>

                <div className="hk-newsCard__info">
                  <div className="hk-newsCard__title">{n.title}</div>
                  <div className="hk-newsCard__desc">
                    {snippet(n.description || n.story || "", 110)}
                  </div>
                  <div className="hk-newsCard__meta">
                    By <b>{n.author || "-"}</b> •{" "}
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hk-newsPager">
          <div style={{ fontWeight: 900, opacity: 0.9 }}>
            Page {page} / {pages} • {total} total
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset <= 0}
            >
              Prev
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                setOffset((o) => (o + limit < total ? o + limit : o))
              }
              disabled={offset + limit >= total}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

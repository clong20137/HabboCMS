import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { hkRequest } from "../../api/hkApi";
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
(data as { error?: string; message?: string })?.error ||
(data as { error?: string; message?: string })?.message ||
"Request failed",
);
}

return data as T;
}

function snippet(value: string, length: number) {
const text = String(value || "")
.replace(/\s+/g, " ")
.trim();

return text.length > length ? `${text.slice(0, length).trim()}…` : text;
}

const APP_BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/";

function withBase(url: string) {
if (!url) return "";
if (/^(https?:)?\/\//i.test(url)) return url;
if (url.startsWith("data:") || url.startsWith("blob:")) return url;

const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
const normalizedBase = APP_BASE.endsWith("/") ? APP_BASE.slice(0, -1) : APP_BASE;

return `${normalizedBase}${normalizedUrl}`;
}

function resolveNewsImageSrc(item: NewsItem) {
const raw =
item.imageUrl?.trim() ||
item.image?.trim() ||
item.imagePath?.trim() ||
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

if (normalized.startsWith("/")) return withBase(normalized);
if (normalized.startsWith("assets/")) return withBase(`/${normalized}`);
if (normalized.startsWith("uploads/")) return withBase(`/${normalized}`);
if (normalized.startsWith("news/")) return withBase(`/assets/${normalized}`);
if (normalized.startsWith("src/assets/news/")) {
return withBase(`/${normalized.replace(/^src\//, "")}`);
}
if (normalized.startsWith("/src/assets/news/")) {
return withBase(normalized.replace(/^\/src/, ""));
}

const fileName = normalized.split("/").pop() || normalized;
return withBase(`/assets/news/${fileName}`);
}

export default function HKNewsList() {
const { showToast } = useToast();

const [search, setSearch] = useState("");
const [items, setItems] = useState<NewsItem[]>([]);
const [total, setTotal] = useState(0);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const limit = 12;
const [offset, setOffset] = useState(0);

const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

async function load(currentSearch = search, currentOffset = offset) {
setLoading(true);
setError("");

try {
const qs = new URLSearchParams();

if (currentSearch.trim()) qs.set("search", currentSearch.trim());
qs.set("limit", String(limit));
qs.set("offset", String(currentOffset));

const data = await hkFetch<ListResponse>(`/api/hk/news?${qs.toString()}`);

setItems(Array.isArray(data.items) ? data.items : []);
setTotal(Number(data.total || 0));
} catch (e) {
const message = e instanceof Error ? e.message : "Failed to load news.";
setError(message);
showToast(message, "error");
} finally {
setLoading(false);
}
}

useEffect(() => {
void load(search, offset);
}, [offset]);

useEffect(() => {
const timeout = window.setTimeout(() => {
setOffset(0);
void load(search, 0);
}, 250);

return () => window.clearTimeout(timeout);
}, [search]);

async function doDelete(id: number) {
if (!window.confirm("Delete this article?")) return;

try {
await hkFetch(`/api/hk/news/${id}`, { method: "DELETE" });
await load(search, offset);
showToast("Article deleted successfully.", "success");
} catch (e) {
const message = e instanceof Error ? e.message : "Failed to delete article.";
showToast(message, "error");
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
{items.map((item) => {
const imageSrc = resolveNewsImageSrc(item);

return (
<div key={item.id} className="hk-newsCard">
<div className="hk-newsCard__thumb">
{imageSrc ? (
<img
src={imageSrc}
alt={item.title}
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
to={`/housekeeping/news/edit/${item.id}`}
title="Edit"
>
<img src={editIcon} alt="Edit" />
</Link>

<button
className="hk-newsCard__iconBtn"
type="button"
title="Delete"
onClick={() => void doDelete(item.id)}
>
<img src={deleteIcon} alt="Delete" />
</button>
</div>
</div>

<div className="hk-newsCard__info">
<div className="hk-newsCard__title">{item.title}</div>
<div className="hk-newsCard__desc">
{snippet(item.description || item.story || "", 110)}
</div>
<div className="hk-newsCard__meta">
By <b>{item.author || "-"}</b> •{" "}
{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
</div>
</div>
</div>
);
})}
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
onClick={() => setOffset((current) => Math.max(0, current - limit))}
disabled={offset <= 0}
>
Prev
</button>

<button
className="btn"
type="button"
onClick={() =>
setOffset((current) => (current + limit < total ? current + limit : current))
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

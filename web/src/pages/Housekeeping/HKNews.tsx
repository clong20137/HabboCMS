import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../ui/toast/ToastContext";

import editIcon from "../../assets/housekeeping/edit.png";
import deleteIcon from "../../assets/housekeeping/delete.png";

type NewsItem = {
id: number;
title: string;
body: string;
image: string;
createdBy: string;
createdAt: string;
updatedAt: string;
};

type ListRes = {
ok: boolean;
total?: number;
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
throw new Error((data as any)?.error || `Request failed (${res.status})`);
}

return data as T;
}

function stripHtml(input: string) {
return String(input || "")
.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
.replace(/<\/?[^>]+(>|$)/g, " ")
.replace(/\s+/g, " ")
.trim();
}

function excerpt(body: string, max = 120) {
const t = stripHtml(body);
if (t.length <= max) return t;
return t.slice(0, max).trimEnd() + "…";
}

function formatDate(iso?: string) {
if (!iso) return "";
const d = new Date(iso);
if (Number.isNaN(d.getTime())) return iso;

return d.toLocaleString(undefined, {
year: "numeric",
month: "short",
day: "2-digit",
});
}

export default function HKNewsList() {
const nav = useNavigate();
const { showToast } = useToast();

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState("");

const [items, setItems] = useState<NewsItem[]>([]);
const [search, setSearch] = useState("");

async function load(showLoadErrorToast = false) {
setLoading(true);
setError("");

try {
const data = await hkFetch<ListRes>("/api/hk/news");
setItems(data.items || []);
} catch (e: any) {
const msg = e?.message || "Failed to load news.";
setError(msg);
setItems([]);

if (showLoadErrorToast) {
showToast(msg, "error");
}
} finally {
setLoading(false);
}
}

useEffect(() => {
load();
}, []);

const filtered = useMemo(() => {
const q = search.trim().toLowerCase();
if (!q) return items;

return items.filter(
(x) =>
x.title.toLowerCase().includes(q) ||
stripHtml(x.body).toLowerCase().includes(q) ||
x.createdBy.toLowerCase().includes(q),
);
}, [items, search]);

async function del(id: number) {
const ok = confirm(`Delete news article #${id}?`);
if (!ok) return;

setSaving(true);
setError("");

try {
await hkFetch(`/api/hk/news/${id}`, { method: "DELETE" });
await load();
showToast("Article deleted successfully.", "success");
} catch (e: any) {
const msg = e?.message || "Failed to delete news.";
setError(msg);
showToast(msg, "error");
} finally {
setSaving(false);
}
}

return (
<div className="hk-news hk-newsList">
<div className="panel">
<div className="panel-head">
<div className="panel-title">Edit Articles</div>
</div>

<div className="panel-body">
<div className="hk-news__searchRow">
<input
className="hk-input hk-news__search"
value={search}
onChange={(e) => setSearch(e.target.value)}
placeholder="Search title, body, author..."
/>
</div>

{error && <div className="hk-alert hk-alert--error">{error}</div>}

<div className="hk-newsList__metaRow">
<div className="muted">
{loading ? "Loading..." : `${filtered.length} article(s)`}
</div>
</div>

{!loading && filtered.length === 0 ? (
<div className="muted">No results.</div>
) : (
<div className="hk-newsCards">
{filtered.map((n) => (
<article
key={n.id}
className="hk-newsCard"
onClick={() => nav(`/housekeeping/news/edit/${n.id}`)}
role="button"
tabIndex={0}
onKeyDown={(e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
nav(`/housekeeping/news/edit/${n.id}`);
}
}}
>
<div className="hk-newsCard__imageWrap">
{n.image ? (
<img
className="hk-newsCard__image"
src={n.image}
alt={n.title}
loading="lazy"
/>
) : (
<div className="hk-newsCard__image hk-newsCard__image--empty">
No Image
</div>
)}

<div
className="hk-newsCard__overlay"
onClick={(e) => e.stopPropagation()}
>
<button
type="button"
className="hk-newsCard__iconBtn"
title="Edit"
aria-label="Edit"
disabled={saving}
onClick={() =>
nav(`/housekeeping/news/edit/${n.id}`)
}
>
<img src={editIcon} alt="" />
</button>

<button
type="button"
className="hk-newsCard__iconBtn hk-newsCard__iconBtn--danger"
title="Delete"
aria-label="Delete"
disabled={saving}
onClick={() => del(n.id)}
>
<img src={deleteIcon} alt="" />
</button>
</div>
</div>

<div className="hk-newsCard__content">
<div className="hk-newsCard__title">{n.title}</div>

<div className="hk-newsCard__desc">
{excerpt(n.body, 140)}
</div>

<div className="hk-newsCard__meta muted">
{n.createdBy ? `${n.createdBy} • ` : ""}
{formatDate(n.createdAt)}
</div>
</div>
</article>
))}
</div>
)}
</div>
</div>
</div>
);
}

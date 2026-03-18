import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { hkRequest } from "../../api/hkApi";
import { useToast } from "../../ui/toast/ToastContext";

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

type GetResponse = {
ok: boolean;
item: NewsItem;
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

const APP_BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/";

function withBase(url: string) {
if (!url) return "";
if (/^(https?:)?\/\//i.test(url)) return url;
if (url.startsWith("data:") || url.startsWith("blob:")) return url;

const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
const normalizedBase = APP_BASE.endsWith("/") ? APP_BASE.slice(0, -1) : APP_BASE;

return `${normalizedBase}${normalizedUrl}`;
}

function normalizeStoredImageValue(rawInput?: string) {
const raw = String(rawInput || "").trim();
if (!raw) return "";

if (
/^(https?:)?\/\//i.test(raw) ||
raw.startsWith("data:") ||
raw.startsWith("blob:")
) {
return raw;
}

return raw.replace(/\\/g, "/").trim();
}

function resolveNewsPreview(rawInput?: string) {
const normalized = normalizeStoredImageValue(rawInput);
if (!normalized) return "";

if (
/^(https?:)?\/\//i.test(normalized) ||
normalized.startsWith("data:") ||
normalized.startsWith("blob:")
) {
return normalized;
}

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

return withBase(`/assets/news/${normalized.split("/").pop() || normalized}`);
}

function BasicHtmlTextareaEditor({
value,
onChange,
disabled,
}: {
value: string;
onChange: (html: string) => void;
disabled?: boolean;
}) {
return (
<div className="hk-editor">
<textarea
className="hk-input"
style={{
width: "100%",
minHeight: 260,
padding: 10,
fontFamily: "monospace",
}}
value={value}
onChange={(e) => onChange(e.target.value)}
disabled={disabled}
placeholder="<p>Write your story here...</p>"
/>
<div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
This field accepts HTML (example: <code>{`<p>Text</p>`}</code>).
</div>
</div>
);
}

export default function HKNewsEdit() {
const { id: idParam } = useParams();
const id = useMemo(() => Number(idParam), [idParam]);
const nav = useNavigate();
const { showToast } = useToast();

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState("");

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [imageUrl, setImageUrl] = useState("");
const [storyHtml, setStoryHtml] = useState("<p></p>");

async function load() {
setLoading(true);
setError("");

try {
const data = await hkFetch<GetResponse>(`/api/hk/news/${id}`);

setTitle(data.item.title || "");
setDescription(data.item.description || "");
setImageUrl(
normalizeStoredImageValue(
data.item.imageUrl || data.item.image || data.item.imagePath || "",
),
);
setStoryHtml(data.item.storyHtml || data.item.story || "<p></p>");
} catch (e) {
const msg = e instanceof Error ? e.message : "Failed to load article.";
setError(msg);
showToast(msg, "error");
} finally {
setLoading(false);
}
}

useEffect(() => {
if (!Number.isFinite(id) || id <= 0) return;
void load();
}, [id]);

async function save() {
setSaving(true);
setError("");

try {
await hkFetch(`/api/hk/news/${id}`, {
method: "PUT",
body: JSON.stringify({
title: title.trim(),
description: description.trim(),
storyHtml: storyHtml.trim(),
imageUrl: imageUrl.trim(),
}),
});

await load();
showToast("Article saved successfully.", "success");
} catch (e) {
const msg = e instanceof Error ? e.message : "Failed to save.";
setError(msg);
showToast(msg, "error");
} finally {
setSaving(false);
}
}

const previewSrc = useMemo(() => resolveNewsPreview(imageUrl), [imageUrl]);

if (!Number.isFinite(id) || id <= 0) {
return (
<div className="panel hk-news">
<div className="panel-head">Edit Article</div>
<div className="panel-body">
<div className="hk-alert hk-alert--error">Invalid article id.</div>
</div>
</div>
);
}

return (
<div className="panel hk-news">
<div className="panel-head">Edit Article</div>

<div className="panel-body">
{error && <div className="hk-alert hk-alert--error">{error}</div>}

{loading ? (
<div className="hk-loading">Loading…</div>
) : (
<div className="hk-news__grid">
<div className="hk-field">
<div className="hk-label">Title</div>
<input
className="hk-input"
value={title}
onChange={(e) => setTitle(e.target.value)}
disabled={saving}
/>
</div>

<div className="hk-field">
<div className="hk-label">Description</div>
<input
className="hk-input"
value={description}
onChange={(e) => setDescription(e.target.value)}
disabled={saving}
/>
</div>

<div className="hk-field">
<div className="hk-label">Image Path or URL</div>
<input
className="hk-input"
value={imageUrl}
onChange={(e) => setImageUrl(e.target.value)}
disabled={saving}
placeholder="/assets/news/example.png or https://..."
/>

<div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
For production, place news images in <code>public/assets/news</code> and
use paths like <code>/assets/news/example.png</code>.
</div>

{previewSrc ? (
<div className="hk-newsImgPreview" style={{ marginTop: 12 }}>
<img src={previewSrc} alt="" />
</div>
) : null}
</div>

<div className="hk-field hk-news__body">
<div className="hk-label">Story</div>
<BasicHtmlTextareaEditor
value={storyHtml}
onChange={setStoryHtml}
disabled={saving}
/>
</div>

<div
className="hk-news__actions"
style={{ display: "flex", gap: 10 }}
>
<button
className="btn btn-primary"
type="button"
onClick={save}
disabled={saving}
>
{saving ? "Saving..." : "Save"}
</button>

<button
className="btn"
type="button"
onClick={() => nav("/housekeeping/news")}
>
Back
</button>
</div>
</div>
)}
</div>
</div>
);
}

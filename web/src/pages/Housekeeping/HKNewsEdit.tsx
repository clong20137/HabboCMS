import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";
import { useNavigate, useParams } from "react-router-dom";
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

type GetResponse = { ok: boolean; item: NewsItem };

type NewsImageItem = {
name: string;
url: string;
};

const IMAGES_PER_PAGE = 12;

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

const newsImageModules = import.meta.glob(
"../../assets/news/*.{png,jpg,jpeg,gif,webp,avif,svg}",
{
eager: true,
import: "default",
},
) as Record<string, string>;

const availableNewsImages: NewsImageItem[] = Object.entries(newsImageModules)
.map(([fullPath, url]) => {
const fileName = fullPath.split("/").pop() || fullPath;

return {
name: fileName,
url,
};
})
.sort((a, b) => a.name.localeCompare(b.name));

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

const normalized = raw.replace(/\\/g, "/");
return normalized.split("/").pop() || normalized;
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

const found = availableNewsImages.find(
(x) => x.name.toLowerCase() === normalized.toLowerCase(),
);

return found?.url || "";
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

function NewsImagePickerModal({
open,
value,
onSelect,
onClear,
onClose,
}: {
open: boolean;
value: string;
onSelect: (fileName: string) => void;
onClear: () => void;
onClose: () => void;
}) {
const [page, setPage] = useState(1);

const totalPages = Math.max(
1,
Math.ceil(availableNewsImages.length / IMAGES_PER_PAGE),
);

useEffect(() => {
if (!open) return;
setPage(1);
}, [open]);

useEffect(() => {
if (!open) return;

const onKeyDown = (e: KeyboardEvent) => {
if (e.key === "Escape") onClose();
};

window.addEventListener("keydown", onKeyDown);
return () => window.removeEventListener("keydown", onKeyDown);
}, [open, onClose]);

useEffect(() => {
if (page > totalPages) setPage(totalPages);
}, [page, totalPages]);

const pageImages = useMemo(() => {
const start = (page - 1) * IMAGES_PER_PAGE;
return availableNewsImages.slice(start, start + IMAGES_PER_PAGE);
}, [page]);

if (!open) return null;

return (
<div
className="hk-modal-backdrop hk-modal-backdrop--animated"
onMouseDown={onClose}
>
<div
className="hk-modal hk-modal--newsImagePicker hk-modal--animated"
onMouseDown={(e) => e.stopPropagation()}
role="dialog"
aria-modal="true"
aria-label="Select News Image"
>
<div className="panel-head">Select News Image</div>

<div className="panel-body">
<div className="hk-newsImgModalTop">
<div className="hk-newsImgModalMeta">
Showing {pageImages.length} of {availableNewsImages.length} images
</div>

<div className="hk-newsImgPagination">
<button
type="button"
className="btn"
onClick={() => setPage((p) => Math.max(1, p - 1))}
disabled={page <= 1}
>
Prev
</button>

<div className="hk-newsImgPagination__status">
Page {page} / {totalPages}
</div>

<button
type="button"
className="btn"
onClick={() =>
setPage((p) => Math.min(totalPages, p + 1))
}
disabled={page >= totalPages}
>
Next
</button>
</div>
</div>

<div className="hk-newsImgGrid">
{pageImages.map((img) => (
<button
key={img.name}
type="button"
className={`hk-newsImgCell ${value === img.name ? "is-active" : ""}`}
onClick={() => {
onSelect(img.name);
onClose();
}}
>
<img src={img.url} alt={img.name} />
<div className="hk-newsImgName">{img.name}</div>
</button>
))}

{!availableNewsImages.length && (
<div className="hk-newsImgEmpty">
No images found in src/assets/news
</div>
)}
</div>

<div className="hk-newsImgActions">
<button className="btn" type="button" onClick={onClose}>
Close
</button>

<button
className="btn btn-primary"
type="button"
onClick={() => {
onClear();
onClose();
}}
>
Clear
</button>
</div>
</div>
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

const [imgOpen, setImgOpen] = useState(false);

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
} catch (e: any) {
const msg = e?.message || "Failed to load article.";
setError(msg);
showToast(msg, "error");
} finally {
setLoading(false);
}
}

useEffect(() => {
if (!Number.isFinite(id) || id <= 0) return;
load();
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
} catch (e: any) {
const msg = e?.message || "Failed to save.";
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
<div className="hk-label">Image</div>

<div className="hk-newsImgPick">
<button
type="button"
className="btn"
onClick={() => setImgOpen(true)}
disabled={saving}
>
Choose Image
</button>

<div className="hk-newsImgPick__value">
{imageUrl || "None selected"}
</div>
</div>

{previewSrc && (
<div className="hk-newsImgPreview">
<img src={previewSrc} alt="" />
</div>
)}
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

<NewsImagePickerModal
open={imgOpen}
value={imageUrl}
onSelect={setImageUrl}
onClear={() => setImageUrl("")}
onClose={() => setImgOpen(false)}
/>
</div>
</div>
);
}

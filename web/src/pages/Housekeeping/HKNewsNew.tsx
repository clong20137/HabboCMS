import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../ui/toast/ToastContext";

type NewsImageItem = {
name: string;
url: string;
};

const IMAGES_PER_PAGE = 12;

async function hkFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
const method = String(opts.method || "GET").toUpperCase();

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

function resolveNewsPreview(rawInput: string) {
const raw = (rawInput || "").trim();
if (!raw) return "";

if (
/^(https?:)?\/\//i.test(raw) ||
raw.startsWith("data:") ||
raw.startsWith("blob:")
) {
return raw;
}

const normalized = raw.replace(/\\/g, "/");
const fileName =
normalized.split("/").pop()?.toLowerCase() || normalized.toLowerCase();

const found = availableNewsImages.find(
(x) => x.name.toLowerCase() === fileName,
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

export default function HKNewsNew() {
const nav = useNavigate();
const { showToast } = useToast();

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [storyHtml, setStoryHtml] = useState("<p></p>");
const [imageUrl, setImageUrl] = useState("");

const [imgOpen, setImgOpen] = useState(false);

const [saving, setSaving] = useState(false);
const [error, setError] = useState<string>("");
const [ok, setOk] = useState<string>("");

async function submit(e: React.FormEvent) {
e.preventDefault();
setError("");
setOk("");

if (!title.trim()) {
setError("Title is required.");
showToast("Title is required.", "warning");
return;
}

const trimmedStory = (storyHtml || "").trim();
if (!trimmedStory || trimmedStory === "<p></p>") {
setError("Story is required.");
showToast("Story is required.", "warning");
return;
}

setSaving(true);

try {
const res = await hkFetch<{ ok: boolean; id: number }>("/api/hk/news", {
method: "POST",
body: JSON.stringify({
title: title.trim(),
description: description.trim(),
storyHtml: trimmedStory,
imageUrl: imageUrl.trim(),
}),
});

setOk("Article created.");
showToast("Article created successfully.", "success");
nav(`/housekeeping/news/edit/${res.id}`);
} catch (e: any) {
const msg = e?.message || "Failed to create.";
setError(msg);
showToast(msg, "error");
} finally {
setSaving(false);
}
}

const previewSrc = useMemo(() => resolveNewsPreview(imageUrl), [imageUrl]);

return (
<div className="panel hk-news">
<div className="panel-head">New Article</div>

<div className="panel-body">
{error && <div className="hk-alert--error">{error}</div>}
{ok && <div className="hk-alert--ok">{ok}</div>}

<form onSubmit={submit} className="hk-news__form">
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
placeholder="Short summary shown in lists (optional)"
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

<div className="hk-news__actions">
<button
className="btn btn-primary"
type="submit"
disabled={saving}
>
{saving ? "Creating..." : "Create"}
</button>
</div>
</div>
</form>

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

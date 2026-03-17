import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hkRequest } from "../../api/hkApi";
import { useToast } from "../../ui/toast/ToastContext";

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

function resolveNewsPreview(rawInput: string) {
const raw = String(rawInput || "").trim();
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

return withBase(`/assets/news/${normalized}`);
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

export default function HKNewsNew() {
const nav = useNavigate();
const { showToast } = useToast();

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [storyHtml, setStoryHtml] = useState("<p></p>");
const [imageUrl, setImageUrl] = useState("");

const [saving, setSaving] = useState(false);
const [error, setError] = useState("");
const [ok, setOk] = useState("");

async function submit(e: React.FormEvent) {
e.preventDefault();
setError("");
setOk("");

if (!title.trim()) {
setError("Title is required.");
showToast("Title is required.", "warning");
return;
}

const trimmedStory = String(storyHtml || "").trim();

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
} catch (e) {
const msg = e instanceof Error ? e.message : "Failed to create.";
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
<img src={previewSrc} alt="Preview" />
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
</div>
</div>
);
}

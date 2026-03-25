import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import { useNavigate, useParams } from "react-router-dom";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import SiteLayout from "../components/layout/SiteLayout";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/toast/ToastContext";
import {
api,
type NewsComment,
type NewsItem,
type NewsDetail,
} from "../api/client";
import "../styles/news.scss";

function fmtDate(iso?: string) {
if (!iso) return "";
const d = new Date(iso);
return d.toLocaleString(undefined, {
year: "numeric",
month: "short",
day: "2-digit",
hour: "numeric",
minute: "2-digit",
});
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

const fileName = normalized.split("/").pop() || normalized;
return withBase(`/assets/news/${fileName}`);
}

const COMMENT_COOLDOWN_MS = 5 * 60 * 1000;
const COMMENTS_PER_PAGE = 10;

function fmtCountdown(msLeft: number) {
const s = Math.max(0, Math.ceil(msLeft / 1000));
const mm = Math.floor(s / 60);
const ss = s % 60;
return `${mm}:${String(ss).padStart(2, "0")}`;
}

type PickerAnchor = {
top: number;
left: number;
width: number;
height: number;
};

function getAnchorPosition(el: HTMLElement): PickerAnchor {
const rect = el.getBoundingClientRect();
return {
top: rect.top,
left: rect.left,
width: rect.width,
height: rect.height,
};
}

function EmojiPopover({
anchorRef,
open,
onClose,
onEmojiClick,
}: {
anchorRef: RefObject<HTMLElement | null>;
open: boolean;
onClose: () => void;
onEmojiClick: (emoji: EmojiClickData) => void;
}) {
const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
const popoverRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
if (!open || !anchorRef.current) return;

function updatePosition() {
if (!anchorRef.current) return;
setAnchor(getAnchorPosition(anchorRef.current));
}

updatePosition();

const onDocMouseDown = (e: MouseEvent) => {
const target = e.target as Node;
const clickedAnchor = anchorRef.current?.contains(target);
const clickedPopover = popoverRef.current?.contains(target);

if (!clickedAnchor && !clickedPopover) onClose();
};

const onKeyDown = (e: KeyboardEvent) => {
if (e.key === "Escape") onClose();
};

window.addEventListener("resize", updatePosition);
window.addEventListener("scroll", updatePosition, true);
document.addEventListener("mousedown", onDocMouseDown);
window.addEventListener("keydown", onKeyDown);

return () => {
window.removeEventListener("resize", updatePosition);
window.removeEventListener("scroll", updatePosition, true);
document.removeEventListener("mousedown", onDocMouseDown);
window.removeEventListener("keydown", onKeyDown);
};
}, [open, onClose, anchorRef]);

if (!open || !anchor) return null;

const pickerWidth = 350;
const pickerHeight = 435;
const viewportWidth = window.innerWidth;
const viewportHeight = window.innerHeight;

const spaceBelow = viewportHeight - (anchor.top + anchor.height);
const openAbove = spaceBelow < pickerHeight + 16;

let left = anchor.left;
if (left + pickerWidth > viewportWidth - 12) {
left = Math.max(12, viewportWidth - pickerWidth - 12);
}

const top = openAbove
? Math.max(12, anchor.top - pickerHeight - 8)
: Math.min(
viewportHeight - pickerHeight - 12,
anchor.top + anchor.height + 8,
);

return createPortal(
<div
ref={popoverRef}
className="news-emoji-popover"
style={{
position: "fixed",
top,
left,
zIndex: 10050,
}}
>
<EmojiPicker
theme={Theme.DARK}
onEmojiClick={onEmojiClick}
lazyLoadEmojis
previewConfig={{ showPreview: false }}
/>
</div>,
document.body,
);
}

export default function NewsStoryPage() {
const nav = useNavigate();
const { id } = useParams();
const newsId = Number(id);

const { user } = useAuth();
const { showToast } = useToast();

const [loading, setLoading] = useState(true);
const [story, setStory] = useState<NewsDetail | null>(null);
const [recent, setRecent] = useState<NewsItem[]>([]);
const [comments, setComments] = useState<NewsComment[]>([]);
const [commentPage, setCommentPage] = useState(1);
const [commentTotalPages, setCommentTotalPages] = useState(1);
const [commentTotal, setCommentTotal] = useState(0);
const [commentBody, setCommentBody] = useState("");
const [posting, setPosting] = useState(false);
const [error, setError] = useState<string | null>(null);

const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
const commentEmojiBtnRef = useRef<HTMLButtonElement | null>(null);

const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);
const reactionButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

const canComment = !!user;

const COOLDOWN_KEY = useMemo(() => {
const uid = user?.id ?? 0;
return `news_comment_cooldown_until:${uid}:${newsId}`;
}, [user?.id, newsId]);

const [cooldownUntil, setCooldownUntil] = useState<number>(() => {
try {
const raw = localStorage.getItem(COOLDOWN_KEY);
const n = raw ? Number(raw) : 0;
return Number.isFinite(n) ? n : 0;
} catch {
return 0;
}
});

const [cooldownText, setCooldownText] = useState("");

useEffect(() => {
try {
const raw = localStorage.getItem(COOLDOWN_KEY);
const n = raw ? Number(raw) : 0;
setCooldownUntil(Number.isFinite(n) ? n : 0);
} catch {
setCooldownUntil(0);
}
}, [COOLDOWN_KEY]);

useEffect(() => {
let alive = true;
setLoading(true);
setError(null);

void (async () => {
try {
if (!Number.isFinite(newsId) || newsId <= 0) {
throw new Error("Invalid story id.");
}

const [s, r] = await Promise.all([
api.getNewsById(newsId),
api.getRecentNews(newsId, 6),
]);

if (!alive) return;

setStory(s);
setRecent(r);
} catch (e) {
if (!alive) return;
const msg = e instanceof Error ? e.message : "Failed to load story.";
setError(msg);
showToast(msg, "error");
} finally {
if (!alive) return;
setLoading(false);
}
})();

return () => {
alive = false;
};
}, [newsId, showToast]);

useEffect(() => {
let alive = true;

void (async () => {
try {
const res = await api.getNewsComments(
newsId,
commentPage,
COMMENTS_PER_PAGE,
);

if (!alive) return;

setComments(Array.isArray(res.items) ? res.items : []);
setCommentTotalPages(Number(res.pagination?.totalPages ?? 1));
setCommentTotal(Number(res.pagination?.total ?? 0));
} catch {
if (!alive) return;
setComments([]);
}
})();

return () => {
alive = false;
};
}, [newsId, commentPage]);

useEffect(() => {
if (!cooldownUntil) return;

const t = window.setInterval(() => {
const left = cooldownUntil - Date.now();

if (left <= 0) {
setCooldownUntil(0);
try {
localStorage.removeItem(COOLDOWN_KEY);
} catch {}
setCooldownText("");
window.clearInterval(t);
return;
}

setCooldownText(`You can comment again in ${fmtCountdown(left)}`);
}, 250);

const left = cooldownUntil - Date.now();
if (left > 0) {
setCooldownText(`You can comment again in ${fmtCountdown(left)}`);
}

return () => window.clearInterval(t);
}, [cooldownUntil, COOLDOWN_KEY]);

const safeStoryHtml = useMemo(() => {
const html = story?.story || "";
return DOMPurify.sanitize(html, {
USE_PROFILES: { html: true },
FORBID_TAGS: ["script", "style"],
FORBID_ATTR: ["onerror", "onload"],
});
}, [story?.story]);

const metaText = useMemo(() => {
if (!story) return "";
const d = fmtDate(story.createdAt);
return `${story.author}${d ? ` • ${d}` : ""}`;
}, [story]);

const storyImage = useMemo(() => {
if (!story) return "";
return resolveNewsPreview(
(story as NewsDetail & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).imageUrl ||
(story as NewsDetail & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).image ||
(story as NewsDetail & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).imagePath ||
"",
);
}, [story]);

const recentWithImages = useMemo(() => {
return recent.map((item) => ({
...item,
resolvedImage: resolveNewsPreview(
(item as NewsItem & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).imageUrl ||
(item as NewsItem & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).image ||
(item as NewsItem & {
imageUrl?: string;
image?: string;
imagePath?: string;
}).imagePath ||
"",
),
}));
}, [recent]);

const isCooldownActive = canComment && cooldownUntil > Date.now();

async function refreshComments(page = 1) {
const res = await api.getNewsComments(newsId, page, COMMENTS_PER_PAGE);
setComments(Array.isArray(res.items) ? res.items : []);
setCommentTotalPages(Number(res.pagination?.totalPages ?? 1));
setCommentTotal(Number(res.pagination?.total ?? 0));
}

async function submitComment() {
const body = commentBody.trim();
if (!body) return;

if (!canComment) {
showToast("You must be logged in to comment.", "warning");
return;
}

if (isCooldownActive) {
showToast(
cooldownText || "Please wait before commenting again.",
"warning",
);
return;
}

try {
setPosting(true);

await api.postNewsComment(newsId, body);
setCommentBody("");
setCommentEmojiOpen(false);

const until = Date.now() + COMMENT_COOLDOWN_MS;
setCooldownUntil(until);

try {
localStorage.setItem(COOLDOWN_KEY, String(until));
} catch {}

setCommentPage(1);
await refreshComments(1);
showToast("Comment posted successfully.", "success");
} catch (e) {
const msg = e instanceof Error ? e.message : "Failed to post comment.";
showToast(msg, "error");

if (String(msg).toLowerCase().includes("wait")) {
const until = Date.now() + COMMENT_COOLDOWN_MS;
setCooldownUntil(until);
try {
localStorage.setItem(COOLDOWN_KEY, String(until));
} catch {}
}
} finally {
setPosting(false);
}
}

async function toggleReaction(commentId: number, reaction: string) {
if (!canComment) {
showToast("You must be logged in to react.", "warning");
return;
}

try {
const r = await api.toggleCommentReaction(commentId, reaction);

setComments((prev) =>
prev.map((c) =>
c.id === commentId
? {
...c,
reactions: r.reactions,
myReactions: r.myReactions,
}
: c,
),
);
} catch (e) {
const msg = e instanceof Error ? e.message : "Failed to react.";
showToast(msg, "error");
}
}

function handleCommentEmojiPick(emojiData: EmojiClickData) {
setCommentBody((prev) => `${prev}${emojiData.emoji}`);
}

return (
<SiteLayout active="home">
<div className="news-page">
<div className="news-layout">
<section className="panel news-main">
<div className="panel-head">NEWS</div>

<div className="panel-body">
{loading ? (
<div className="muted">Loading...</div>
) : error ? (
<div className="muted">{error}</div>
) : !story ? (
<div className="muted">Story not found.</div>
) : (
<>
<div className="news-hero">
{storyImage ? (
<img
className="news-hero-img"
src={storyImage}
alt={story.title}
/>
) : (
<div className="news-hero-img news-hero-img--empty" />
)}
</div>

<h1 className="news-h1">{story.title}</h1>

<div
className="news-story"
dangerouslySetInnerHTML={{ __html: safeStoryHtml }}
/>

<div className="news-footer">
<div className="news-meta">{metaText}</div>
</div>

<div className="news-comments">
<div className="news-comments-head">
Comments ({commentTotal})
</div>

{!canComment ? (
<div className="muted">
You must be logged in to comment.
</div>
) : (
<div className="news-comment-box">
<textarea
className="news-comment-input"
placeholder="Write a comment..."
value={commentBody}
onChange={(e) => setCommentBody(e.target.value)}
rows={3}
disabled={posting || isCooldownActive}
/>

<div className="news-comment-toolbar">
<button
ref={commentEmojiBtnRef}
type="button"
className="btn"
onClick={() => setCommentEmojiOpen((prev) => !prev)}
disabled={posting || isCooldownActive}
>
😊 Emoji
</button>
</div>

{isCooldownActive && (
<div className="muted" style={{ marginTop: 6 }}>
{cooldownText ||
"Please wait before commenting again."}
</div>
)}

<button
className="btn btn-primary"
type="button"
disabled={
posting ||
isCooldownActive ||
commentBody.trim().length < 2
}
onClick={() => void submitComment()}
style={{ marginTop: 10 }}
>
{posting ? "Posting..." : "Post Comment"}
</button>

<EmojiPopover
anchorRef={commentEmojiBtnRef}
open={commentEmojiOpen}
onClose={() => setCommentEmojiOpen(false)}
onEmojiClick={handleCommentEmojiPick}
/>
</div>
)}

<div className="news-comment-list">
{comments.length === 0 ? (
<div className="muted">No comments yet.</div>
) : (
comments.map((c) => {
const reactions = c.reactions || {};
const my = Array.isArray(c.myReactions)
? c.myReactions
: [];
const reactionEntries = Object.entries(reactions).sort(
(a, b) => b[1] - a[1],
);

return (
<div className="news-comment" key={c.id}>
<div className="news-comment-top">
<div className="news-comment-user">
{c.username}
</div>
<div className="news-comment-date muted">
{fmtDate(c.createdAt)}
</div>
</div>

<div className="news-comment-body">{c.body}</div>

<div className="comment-actions">
{reactionEntries.map(([emoji, count]) => {
const active = my.includes(emoji);

return (
<button
key={emoji}
type="button"
className={`react-btn ${active ? "active" : ""}`}
onClick={() => void toggleReaction(c.id, emoji)}
>
{emoji} <span>{count}</span>
</button>
);
})}

<button
ref={(el) => {
reactionButtonRefs.current[c.id] = el;
}}
type="button"
className="react-btn react-btn--picker"
onClick={() =>
setReactionPickerFor(
reactionPickerFor === c.id ? null : c.id,
)
}
>
➕ React
</button>

<EmojiPopover
anchorRef={{
current: reactionButtonRefs.current[c.id],
}}
open={reactionPickerFor === c.id}
onClose={() => setReactionPickerFor(null)}
onEmojiClick={(emojiData) => {
setReactionPickerFor(null);
void toggleReaction(c.id, emojiData.emoji);
}}
/>
</div>
</div>
);
})
)}
</div>

{commentTotalPages > 1 && (
<div className="news-comment-pagination">
<button
type="button"
className="btn"
disabled={commentPage <= 1}
onClick={() =>
setCommentPage((p) => Math.max(1, p - 1))
}
>
Previous
</button>

<div className="muted" style={{ alignSelf: "center" }}>
Page {commentPage} of {commentTotalPages}
</div>

<button
type="button"
className="btn"
disabled={commentPage >= commentTotalPages}
onClick={() =>
setCommentPage((p) =>
Math.min(commentTotalPages, p + 1),
)
}
>
Next
</button>
</div>
)}
</div>
</>
)}
</div>
</section>

<aside className="panel news-side recent-news-panel">
<div className="panel-head">RECENT NEWS</div>
<div className="panel-body">
{recentWithImages.length === 0 ? (
<div className="muted">No recent articles.</div>
) : (
<div className="recent-list">
{recentWithImages.map((n) => (
<button
key={n.id}
type="button"
className="recent-item"
onClick={() => nav(`/news/${n.id}`)}
>
<div className="recent-thumb">
{n.resolvedImage ? (
<img src={n.resolvedImage} alt={n.title} />
) : (
<div className="recent-thumb__empty" />
)}
</div>

<div className="recent-info">
<div className="recent-title">{n.title}</div>
<div className="recent-meta muted">
{n.author} • {fmtDate(n.createdAt)}
</div>
</div>
</button>
))}
</div>
)}
</div>
</aside>
</div>
</div>
</SiteLayout>
);
}

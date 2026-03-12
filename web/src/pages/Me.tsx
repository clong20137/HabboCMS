import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { useAuth } from "../auth/AuthContext";
import { api, type NewsItem } from "../api/client";
import "../styles/me.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";

function clampPct(value: number) {
if (!Number.isFinite(value)) return 0;
return Math.max(0, Math.min(100, value));
}

function pct(current: number, max: number) {
if (!max || max <= 0) return 0;
return clampPct((current / max) * 100);
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

const normalized = raw.replace(/\\/g, "/");
return normalized.split("/").pop() || normalized;
}

const newsImageModules = import.meta.glob(
"../assets/news/*.{png,jpg,jpeg,gif,webp,avif,svg}",
{
eager: true,
import: "default",
},
) as Record<string, string>;

const availableNewsImages = Object.entries(newsImageModules)
.map(([fullPath, url]) => {
const fileName = fullPath.split("/").pop() || fullPath;
return {
name: fileName,
url,
};
})
.sort((a, b) => a.name.localeCompare(b.name));

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

return found?.url || normalized;
}

const FADE_MS = 300;

export default function Me() {
useHotelTitle("Me");
const nav = useNavigate();
const { user, loading } = useAuth();

const [news, setNews] = useState<NewsItem[]>([]);
const [newsIdx, setNewsIdx] = useState(0);

const [isFading, setIsFading] = useState(false);
const pendingIdxRef = useRef<number | null>(null);
const fadeTimerRef = useRef<number | null>(null);

useEffect(() => {
let alive = true;

(async () => {
try {
const items = await api.getNews(3);
if (!alive) return;
setNews(items);
setNewsIdx(0);
} catch {
if (!alive) return;
setNews([]);
}
})();

return () => {
alive = false;
};
}, []);

function goToSlide(nextIndex: number) {
if (!news.length) return;
if (nextIndex === newsIdx) return;

if (isFading) {
pendingIdxRef.current = nextIndex;
return;
}

setIsFading(true);

if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

fadeTimerRef.current = window.setTimeout(() => {
setNewsIdx(nextIndex);
setIsFading(false);

const queued = pendingIdxRef.current;
pendingIdxRef.current = null;

if (queued !== null && queued !== nextIndex) {
window.setTimeout(() => goToSlide(queued), 0);
}
}, FADE_MS);
}

useEffect(() => {
if (news.length <= 1) return;

const t = window.setInterval(() => {
const next = (newsIdx + 1) % news.length;
goToSlide(next);
}, 10000);

return () => window.clearInterval(t);
}, [newsIdx, news.length]);

useEffect(() => {
return () => {
if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
};
}, []);

if (loading) {
return (
<SiteLayout active="home">
<div className="panel">
<div className="panel-body">Loading...</div>
</div>
</SiteLayout>
);
}

if (!user) {
return (
<SiteLayout active="home">
<div className="panel">
<div className="panel-body">
<div className="muted">Not logged in.</div>
</div>
</div>
</SiteLayout>
);
}

const health = Number(user.health ?? 0);
const maxHealth = Number(user.maxHealth ?? 0);
const energy = Number(user.energy ?? 0);
const maxEnergy = Number(user.maxEnergy ?? 0);
const kills = Number(user.kills ?? 0);
const deaths = Number(user.deaths ?? 0);
const kd = deaths > 0 ? kills / deaths : kills;

const activeNews = news[newsIdx];
const activeNewsImage = useMemo(() => {
if (!activeNews) return "";

return resolveNewsPreview(
(activeNews as any).imageUrl ||
(activeNews as any).image ||
(activeNews as any).imagePath ||
"",
);
}, [activeNews]);

const corporation = user.corporation ?? null;

return (
<SiteLayout active="home">
<div className="me-grid">
<section className="panel panel-main">
<div className="panel-head">PROFILE</div>

<div className="panel-body">
<div className="panel-title">
<div className="avatar-placeholder" />
<div>
<div className="me-name">{user.username}</div>
<div className="me-sub">Level {Number(user.level ?? 0)}</div>
</div>
</div>

<div className="stats">
<div className="stat">
<div className="stat-label">Health</div>
<div className="bar">
<div
className="bar-fill bar-fill--health"
style={{ width: `${pct(health, maxHealth)}%` }}
/>
</div>
<div className="stat-value">
{health} / {maxHealth}
</div>
</div>

<div className="stat">
<div className="stat-label">Energy</div>
<div className="bar">
<div
className="bar-fill bar-fill--energy"
style={{ width: `${pct(energy, maxEnergy)}%` }}
/>
</div>
<div className="stat-value">
{energy} / {maxEnergy}
</div>
</div>
</div>

<div className="mini-stats">
<div className="mini">
K/D <br />
<b>{kd.toFixed(2)}</b>
</div>
<div className="mini">
Cash <br />
<b>${Number(user.credits ?? 0).toLocaleString()}</b>
</div>
<div className="mini">
Bank <br />
<b>
$
{Number(
user.bank_credits ?? user.bank_amount ?? 0,
).toLocaleString()}
</b>
</div>
<div className="mini">
Account <br />
<b>Standard</b>
</div>
<div className="mini">
Rank <br />
<b>{user.rank ?? "-"}</b>
</div>
</div>
</div>
</section>

<aside className="me-side">
<section className="panel panel-side">
<div className="panel-head">NEWS</div>
<div className="panel-body">
{!activeNews ? (
<div className="muted">No news yet.</div>
) : (
<div className="news-card">
<div className="news-media">
<div
className={`news-fade ${isFading ? "is-fading" : ""}`}
style={{ transitionDuration: `${FADE_MS}ms` }}
>
{activeNewsImage ? (
<img
className="news-img"
src={activeNewsImage}
alt={activeNews.title}
width={759}
height={300}
loading="lazy"
/>
) : (
<div className="news-img news-img--empty" />
)}

<div className="news-overlay">
<div className="news-overlay__inner">
<div className="news-title">
{activeNews.title}
</div>
<div className="news-desc">
{activeNews.description}
</div>
<div className="news-author">
by {activeNews.author}
</div>
</div>

{news.length > 1 && (
<div className="news-dots">
{news.map((_, i) => (
<button
key={i}
type="button"
className={`news-dot ${i === newsIdx ? "active" : ""}`}
onClick={() => goToSlide(i)}
/>
))}
</div>
)}
</div>
</div>
</div>

<button
className="btn btn-primary news-btn"
type="button"
onClick={() => nav(`/news/${activeNews.id}`)}
>
Read More
</button>
</div>
)}
</div>
</section>

<section className="panel panel-side">
<div className="panel-head">CORPORATION</div>
<div className="panel-body">
{corporation ? (
<div className="corp">
<div className="corp-badge">
{corporation.icon ? (
<img
src={`/assets/corporations/${corporation.icon}`}
alt={corporation.name}
style={{
width: 42,
height: 42,
objectFit: "contain",
display: "block",
}}
/>
) : (
corporation.name.slice(0, 2).toUpperCase()
)}
</div>

<div>
<div className="corp-name">{corporation.name}</div>
<div className="muted">
{corporation.rankName || "Employee"}
{corporation.isManager ? " • Manager" : ""}
</div>

<div
className="muted"
style={{
marginTop: 6,
fontSize: 12,
lineHeight: 1.4,
}}
>
Weekly Shifts:{" "}
{Number(corporation.weeklyShifts ?? 0)}
<br />
Total Shifts:{" "}
{Number(corporation.totalShifts ?? 0)}
</div>
</div>
</div>
) : (
<div className="corp">
<div className="corp-badge">N/A</div>
<div>
<div className="corp-name">Unemployed</div>
<div className="muted">No rank</div>
</div>
</div>
)}
</div>
</section>

<section className="panel panel-side">
<div className="panel-head">DISCORD</div>
<div className="panel-body">
<div className="discord-row">
<div className="muted">
Link your Discord to get verified on our server.
</div>
<button
className="btn btn-primary"
style={{ width: "100%", marginTop: 10 }}
type="button"
>
Link Discord
</button>
</div>
</div>
</section>
</aside>
</div>
</SiteLayout>
);
}

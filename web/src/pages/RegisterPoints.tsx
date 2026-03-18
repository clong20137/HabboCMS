import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { api } from "../api/client";
import { useToast } from "../ui/toast/ToastContext";
import { useHotelTitle } from "../hooks/useHotelTitle";

import plusGif from "../assets/register/plus.gif";
import minusGif from "../assets/register/minus.gif";

import strengthImg from "../assets/register/strength.gif";
import knowledgeImg from "../assets/register/knowledge.gif";
import farmingImg from "../assets/register/farming.gif";
import healthImg from "../assets/register/health.png";
import defenseImg from "../assets/register/defense.gif";
import staminaImg from "../assets/register/stamina.gif";

import "../styles/register.scss";

type StatsSetupStatus = {
ok: true;
statsSetupDone: boolean;
points: number;

strength: number;
knowledge: number;
farming: number;
health: number;
defense: number;
stamina: number;

maxHealth: number;
maxEnergy: number;
};

type IncPayload = {
strength: number;
knowledge: number;
farming: number;
health: number;
defense: number;
stamina: number;
};

const emptyInc: IncPayload = {
strength: 0,
knowledge: 0,
farming: 0,
health: 0,
defense: 0,
stamina: 0,
};

function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

export default function RegisterPoints() {
useHotelTitle("Allocate Points");

const nav = useNavigate();
const { showToast } = useToast();

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

const [base, setBase] = useState<StatsSetupStatus | null>(null);
const [inc, setInc] = useState<IncPayload>({ ...emptyInc });

const spent = useMemo(
() =>
inc.strength +
inc.knowledge +
inc.farming +
inc.health +
inc.defense +
inc.stamina,
[inc],
);

const remaining = useMemo(() => {
const pts = base?.points ?? 0;
return pts - spent;
}, [base, spent]);

const canSubmit = useMemo(() => {
if (!base) return false;
if (saving) return false;
if (base.statsSetupDone) return false;
if (base.points <= 0) return false;
if (remaining !== 0) return false; // must allocate ALL points
return true;
}, [base, saving, remaining]);

const STAT_META = useMemo(
() =>
[
{
key: "strength" as const,
label: "Strength",
desc: "Increasing your strength allows your character to deal more damage which is crucial to the fighting aspect of the game.",
image: strengthImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const v = b.strength + i.strength;
return `Level ${v}${i.strength > 0 ? ` (+${i.strength})` : ""}`;
},
},
{
key: "knowledge" as const,
label: "Knowledge",
desc: "Increase your knowledge allows your character to get things done more effiently and quicker than most and can lead to more pay at your job.",
image: knowledgeImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const v = b.knowledge + i.knowledge;
return `Level ${v}${i.knowledge > 0 ? ` (+${i.knowledge})` : ""}`;
},
},
{
key: "farming" as const,
label: "Farming",
desc: "Increasing your farming allows your character to farm quicker and increases the chance of finding rare and craftable items.",
image: farmingImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const v = b.farming + i.farming;
return `Level ${v}${i.farming > 0 ? ` (+${i.farming})` : ""}`;
},
},
{
key: "health" as const,
label: "Health",
desc: "Increasing your health allows your character to live longer and increases your max health an additional 5 for every level.",
image: healthImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const lvl = b.health + i.health;
const mh = b.maxHealth + i.health * 5;
return `Level ${lvl} • Max Health ${mh}${i.health > 0 ? ` (+${i.health * 5})` : ""}`;
},
},
{
key: "defense" as const,
label: "Defense",
desc: "Increasing your defense allows your character to dodge incoming attacks from other players. Each level increases your chance of dodging an attack.",
image: defenseImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const v = b.defense + i.defense;
return `Level ${v}${i.defense > 0 ? ` (+${i.defense})` : ""}`;
},
},
{
key: "stamina" as const,
label: "Stamina",
desc: "Increasing your stamina allows your character to have more energy, increasing your max energy an additioanl 5 for every level.",
image: staminaImg,
preview: (b: StatsSetupStatus, i: IncPayload) => {
const lvl = b.stamina + i.stamina;
const me = b.maxEnergy + i.stamina * 5;
return `Level ${lvl} • Max Energy ${me}${i.stamina > 0 ? ` (+${i.stamina * 5})` : ""}`;
},
},
] as const,
[],
);

useEffect(() => {
let alive = true;

(async () => {
try {
setLoading(true);
const s = await api.getStatsSetupStatus();
if (!alive) return;

if (!s?.ok) throw new Error("Failed to load points.");

if (s.statsSetupDone || Number(s.points || 0) <= 0) {
showToast("Points already allocated.", "info");
nav("/client", { replace: true });
return;
}

setBase(s as StatsSetupStatus);
setInc({ ...emptyInc });
} catch (e: any) {
showToast(e?.message || "Failed to load points.", "error");
nav("/me", { replace: true });
} finally {
if (!alive) return;
setLoading(false);
}
})();

return () => {
alive = false;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

function bump(key: keyof IncPayload, delta: number) {
if (!base) return;
if (base.statsSetupDone) return;
if (saving) return;

setInc((prev) => {
const next = { ...prev };
const cur = next[key];

if (delta > 0) {
if (remaining <= 0) return prev;
next[key] = cur + 1;
} else {
if (cur <= 0) return prev;
next[key] = cur - 1;
}
return next;
});
}

async function submit() {
if (!base) return;

if (remaining !== 0) {
showToast("You must spend all 5 points to continue.", "warning");
return;
}

setSaving(true);
try {
await api.applyStatsSetup(inc);
showToast("Points applied! Welcome!", "success");
nav("/client", { replace: true });
} catch (e: any) {
showToast(e?.message || "Failed to apply points.", "error");
} finally {
setSaving(false);
}
}

const maxForBar = 10;
const barPct = (n: number) => `${clamp((n / maxForBar) * 100, 0, 100)}%`;

return (
<SiteLayout active="home">
<div className="register-points-page">
<div className="rp-two-panels">
{/* LEFT PANEL: Allocator */}
<section className="panel rp-panel rp-panel--left">
<div className="panel-head rp-head">Character Levels</div>

<div className="panel-body rp-body">
{loading || !base ? (
<div className="muted">Loading your points…</div>
) : (
<>
<div className="rp-top">
<div className="rp-title">
You have <span className="rp-points">{base.points}</span> points to spend.
</div>

<div className="rp-sub">
Each user gets to spend points upon registration, you can only do this once.
Each level can continue to be progressed in-game.
</div>

<div className="rp-remaining">
Remaining:{" "}
<span className={`rp-remaining__num ${remaining === 0 ? "is-zero" : ""}`}>
{remaining}
</span>
</div>
</div>

<div className="rp-grid">
{STAT_META.map((s) => {
const allocated = inc[s.key];
const baseVal = (base as any)[s.key] as number;
const totalVal = baseVal + allocated;

return (
<div className="rp-row" key={s.key}>
<div className="rp-left">
<div className="rp-label">{s.label}</div>

</div>

<div className="rp-mid">
<button
type="button"
className="rp-btn rp-btn--minus"
onClick={() => bump(s.key, -1)}
disabled={saving || allocated <= 0}
aria-label={`Decrease ${s.label}`}
>
<img src={minusGif} alt="-" />
</button>

{/* ✅ Progress bar is BACK */}
<div className="rp-bar">
<div
className="rp-bar__fill"
style={{ width: barPct(totalVal) }}
/>
<div className="rp-bar__text">
{totalVal}
{allocated > 0 ? (
<span className="rp-bar__inc"> (+{allocated})</span>
) : null}
</div>
</div>

<button
type="button"
className="rp-btn rp-btn--plus"
onClick={() => bump(s.key, +1)}
disabled={saving || remaining <= 0}
aria-label={`Increase ${s.label}`}
>
<img src={plusGif} alt="+" />
</button>
</div>

<div className="rp-right">{s.preview(base, inc)}</div>
</div>
);
})}
</div>

<div className="rp-actions">
<button
type="button"
className="btn btn-primary"
onClick={submit}
disabled={!canSubmit}
>
{saving ? "Saving..." : "Continue"}
</button>

<div className="rp-note muted">
Tip: Use the plus/minus buttons to assign points.
</div>
</div>
</>
)}
</div>
</section>

{/* RIGHT PANEL: Description / Guide */}
<section className="panel rp-panel rp-panel--right">
<div className="panel-head rp-head">What Each Stat Does</div>

<div className="panel-body rp-body rp-info">
<div className="rp-info__sub">
Pick a build that matches your playstyle. This is permanent.
</div>

<div className="rp-info__list">
{STAT_META.map((s) => (
<div key={s.key} className="rp-info__card">
<div className="rp-info__img">
<img src={s.image} alt={s.label} />
</div>
<div className="rp-info__text">
<div className="rp-info__name">{s.label}</div>
<div className="rp-info__desc">{s.desc}</div>
</div>
</div>
))}
</div>
</div>
</section>
</div>
</div>
</SiteLayout>
);
}

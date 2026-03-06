import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";

type BanRow = {
id: number;
bantype: "user" | "ip" | "machine";
value: string;
reason: string;
expire: number; // unix seconds, 0 = permanent
added_by: string;
added_date: number; // unix seconds
appeal_state: "0" | "1" | "2";
};

function fmtDate(unix: number) {
if (!unix) return "—";
const d = new Date(unix * 1000);
return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function fmtExpire(expire: number) {
if (!expire) return "Permanent";
return fmtDate(expire);
}

function isActive(expire: number) {
if (!expire) return true;
return expire * 1000 > Date.now();
}

export default function HKBans() {
const [loading, setLoading] = useState(true);
const [items, setItems] = useState<BanRow[]>([]);
const [error, setError] = useState("");

const [q, setQ] = useState("");
const [bantype, setBantype] = useState<"" | "user" | "ip" | "machine">("");

// Create form
const [newType, setNewType] = useState<"user" | "ip" | "machine">("user");
const [newValue, setNewValue] = useState("");
const [newReason, setNewReason] = useState("");
const [newDuration, setNewDuration] = useState<number>(3600); // 1 hour
const [newPermanent, setNewPermanent] = useState(false);
const [busy, setBusy] = useState(false);

// Edit modal
const [editOpen, setEditOpen] = useState(false);
const [editRow, setEditRow] = useState<BanRow | null>(null);
const [editReason, setEditReason] = useState("");
const [editPermanent, setEditPermanent] = useState(false);
const [editDuration, setEditDuration] = useState<number>(3600);
const [editAppeal, setEditAppeal] = useState<"0" | "1" | "2">("0");

async function load() {
setLoading(true);
setError("");
try {
const params = new URLSearchParams();
if (q.trim()) params.set("q", q.trim());
if (bantype) params.set("bantype", bantype);
params.set("limit", "100");

const res = await hkRequest<{ ok: true; items: BanRow[] }>(`/hk/bans?${params}`);
setItems(Array.isArray(res.items) ? res.items : []);
} catch (e: any) {
setError(e?.message || "Failed to load bans.");
setItems([]);
} finally {
setLoading(false);
}
}

useEffect(() => {
load();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const activeCount = useMemo(
() => items.filter((x) => isActive(Number(x.expire))).length,
[items],
);

async function createBan() {
if (!newValue.trim() || !newReason.trim()) {
alert("Value and reason are required.");
return;
}

setBusy(true);
try {
await hkRequest(`/hk/bans`, {
method: "POST",
body: JSON.stringify({
bantype: newType,
value: newValue.trim(),
reason: newReason.trim(),
permanent: newPermanent,
durationSeconds: newPermanent ? undefined : Number(newDuration || 0),
}),
});

setNewValue("");
setNewReason("");
setNewDuration(3600);
setNewPermanent(false);

await load();
} catch (e: any) {
alert(e?.message || "Failed to create ban.");
} finally {
setBusy(false);
}
}

function openEdit(row: BanRow) {
setEditRow(row);
setEditReason(row.reason || "");
setEditPermanent(!row.expire);
setEditDuration(3600);
setEditAppeal(row.appeal_state || "0");
setEditOpen(true);
}

async function saveEdit() {
if (!editRow) return;
if (!editReason.trim()) {
alert("Reason is required.");
return;
}

setBusy(true);
try {
await hkRequest(`/hk/bans/${editRow.id}`, {
method: "PUT",
body: JSON.stringify({
reason: editReason.trim(),
permanent: editPermanent,
durationSeconds: editPermanent ? undefined : Number(editDuration || 0),
appeal_state: editAppeal,
}),
});

setEditOpen(false);
setEditRow(null);
await load();
} catch (e: any) {
alert(e?.message || "Failed to update ban.");
} finally {
setBusy(false);
}
}

async function deleteBan(row: BanRow) {
const yes = confirm(`Delete ban #${row.id} (${row.bantype}:${row.value})?`);
if (!yes) return;

setBusy(true);
try {
await hkRequest(`/hk/bans/${row.id}`, { method: "DELETE" });
await load();
} catch (e: any) {
alert(e?.message || "Failed to delete ban.");
} finally {
setBusy(false);
}
}

return (
<div className="panel">
<div className="panel-head">
<div className="panel-title">Bans</div>
</div>

<div className="panel-body">
{/* Filters */}
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
<input
className="atom-input"
style={{ minWidth: 240 }}
placeholder="Search value or reason…"
value={q}
onChange={(e) => setQ(e.target.value)}
/>

<select
className="atom-input"
value={bantype}
onChange={(e) => setBantype(e.target.value as any)}
>
<option value="">All types</option>
<option value="user">User</option>
<option value="ip">IP</option>
<option value="machine">Machine</option>
</select>

<button className="btn btn-primary" onClick={load} disabled={loading || busy}>
{loading ? "Loading…" : "Search"}
</button>

<div className="muted" style={{ marginLeft: "auto" }}>
Active: <b>{activeCount}</b> • Total: <b>{items.length}</b>
</div>
</div>

<div className="dropdown-sep" style={{ margin: "14px 0" }} />

{/* Create */}
<div className="panel" style={{ marginBottom: 12 }}>
<div className="panel-head">
<div className="panel-title">Add Ban</div>
</div>
<div className="panel-body">
<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<select
className="atom-input"
value={newType}
onChange={(e) => setNewType(e.target.value as any)}
>
<option value="user">User</option>
<option value="ip">IP</option>
<option value="machine">Machine</option>
</select>

<input
className="atom-input"
style={{ minWidth: 200 }}
placeholder="Value (username / ip / machine id)"
value={newValue}
onChange={(e) => setNewValue(e.target.value)}
/>

<input
className="atom-input"
style={{ minWidth: 280, flex: 1 }}
placeholder="Reason"
value={newReason}
onChange={(e) => setNewReason(e.target.value)}
/>

<label style={{ display: "flex", alignItems: "center", gap: 8 }}>
<input
type="checkbox"
checked={newPermanent}
onChange={(e) => setNewPermanent(e.target.checked)}
/>
Permanent
</label>

{!newPermanent && (
<input
className="atom-input"
type="number"
min={60}
max={60 * 60 * 24 * 365 * 5}
step={60}
value={newDuration}
onChange={(e) => setNewDuration(Number(e.target.value))}
placeholder="Duration (seconds)"
title="Duration in seconds"
style={{ width: 180 }}
/>
)}

<button className="btn btn-primary" onClick={createBan} disabled={busy}>
{busy ? "Saving…" : "Add"}
</button>
</div>
</div>
</div>

{/* List */}
{error && <div className="hk-error">{error}</div>}

<div style={{ overflowX: "auto" }}>
<table className="hk-table" style={{ width: "100%", marginTop: 10 }}>
<thead>
<tr>
<th>ID</th>
<th>Type</th>
<th>Value</th>
<th>Reason</th>
<th>Expires</th>
<th>Added</th>
<th>By</th>
<th>Appeal</th>
<th />
</tr>
</thead>
<tbody>
{!loading && items.length === 0 && (
<tr>
<td colSpan={9} className="muted">
No bans found.
</td>
</tr>
)}

{items.map((r) => {
const active = isActive(Number(r.expire));
return (
<tr key={r.id} style={{ opacity: active ? 1 : 0.6 }}>
<td>{r.id}</td>
<td>{r.bantype}</td>
<td>
<b>{r.value}</b>
</td>
<td style={{ maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.reason}
</td>
<td>{fmtExpire(Number(r.expire))}</td>
<td>{fmtDate(Number(r.added_date))}</td>
<td>{r.added_by}</td>
<td>{r.appeal_state}</td>
<td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
<button className="btn" onClick={() => openEdit(r)} disabled={busy}>
Edit
</button>
<button className="btn btn-danger" onClick={() => deleteBan(r)} disabled={busy}>
Delete
</button>
</td>
</tr>
);
})}
</tbody>
</table>
</div>

{/* Edit modal (simple) */}
{editOpen && editRow && (
<div className="panel" style={{ marginTop: 14 }}>
<div className="panel-head">
<div className="panel-title">
Edit Ban #{editRow.id} ({editRow.bantype}:{editRow.value})
</div>
</div>
<div className="panel-body">
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
<input
className="atom-input"
style={{ minWidth: 420, flex: 1 }}
value={editReason}
onChange={(e) => setEditReason(e.target.value)}
placeholder="Reason"
/>

<label style={{ display: "flex", alignItems: "center", gap: 8 }}>
<input
type="checkbox"
checked={editPermanent}
onChange={(e) => setEditPermanent(e.target.checked)}
/>
Permanent
</label>

{!editPermanent && (
<input
className="atom-input"
type="number"
min={60}
max={60 * 60 * 24 * 365 * 5}
step={60}
value={editDuration}
onChange={(e) => setEditDuration(Number(e.target.value))}
placeholder="Reset duration (seconds)"
style={{ width: 220 }}
/>
)}

<select
className="atom-input"
value={editAppeal}
onChange={(e) => setEditAppeal(e.target.value as any)}
title="Appeal state (0/1/2)"
>
<option value="0">0</option>
<option value="1">1</option>
<option value="2">2</option>
</select>

<button className="btn btn-primary" onClick={saveEdit} disabled={busy}>
{busy ? "Saving…" : "Save"}
</button>

<button
className="btn"
onClick={() => {
setEditOpen(false);
setEditRow(null);
}}
disabled={busy}
>
Cancel
</button>
</div>

<div className="muted" style={{ marginTop: 10 }}>
Current expires: <b>{fmtExpire(Number(editRow.expire))}</b>
</div>
</div>
</div>
)}
</div>
</div>
);
}

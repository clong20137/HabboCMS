import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";

type BanKind = "account" | "ip" | "machine";

type BanRow = {
id: number;
bantype: BanKind;
value?: string;
user_id?: number | null;
ip?: string | null;
machine_id?: string | null;
reason: string;
expire: number; // unix seconds, 0 = permanent
added_by?: string;
added_date: number; // unix seconds
appeal_state?: "0" | "1" | "2";
};

const BAN_DURATION_OPTIONS = [
  { label: "2 hours", value: 2 * 60 * 60 },
  { label: "6 hours", value: 6 * 60 * 60 },
  { label: "12 hours", value: 12 * 60 * 60 },
  { label: "24 hours", value: 24 * 60 * 60 },
  { label: "3 days", value: 3 * 24 * 60 * 60 },
  { label: "1 week", value: 7 * 24 * 60 * 60 },
  { label: "1 month", value: 30 * 24 * 60 * 60 },
  { label: "6 months", value: 180 * 24 * 60 * 60 },
  { label: "1 year", value: 365 * 24 * 60 * 60 },
] as const;

function getBanValue(row: BanRow) {
  if (row.bantype === "account") return row.value || String(row.user_id || "");
  if (row.bantype === "ip") return row.value || String(row.ip || "");
  return row.value || String(row.machine_id || "");
}

function getCreatePayload(type: BanKind, rawValue: string) {
  const value = rawValue.trim();
  if (type === "account") {
    return { bantype: "account" as const, user_id: Number(value) };
  }
  if (type === "ip") {
    return { bantype: "ip" as const, ip: value };
  }
  return { bantype: "machine" as const, machine_id: value };
}

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
const [bantype, setBantype] = useState<"" | BanKind>("");

// Create form
const [newType, setNewType] = useState<BanKind>("account");
const [newValue, setNewValue] = useState("");
const [newReason, setNewReason] = useState("");
const [newDuration, setNewDuration] = useState<number>(BAN_DURATION_OPTIONS[0].value);
const [newPermanent, setNewPermanent] = useState(false);
const [busy, setBusy] = useState(false);

// Edit modal
const [editOpen, setEditOpen] = useState(false);
const [editRow, setEditRow] = useState<BanRow | null>(null);
const [editReason, setEditReason] = useState("");
const [editPermanent, setEditPermanent] = useState(false);
const [editDuration, setEditDuration] = useState<number>(BAN_DURATION_OPTIONS[0].value);
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
...getCreatePayload(newType, newValue),
reason: newReason.trim(),
permanent: newPermanent,
durationSeconds: newPermanent ? undefined : Number(newDuration || 0),
}),
});

setNewValue("");
setNewReason("");
setNewDuration(BAN_DURATION_OPTIONS[0].value);
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
setEditDuration(BAN_DURATION_OPTIONS[0].value);
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
const yes = confirm(`Delete ban #${row.id} (${row.bantype}:${getBanValue(row)})?`);
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
<option value="account">Account</option>
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
<option value="account">Account</option>
<option value="ip">IP</option>
<option value="machine">Machine</option>
</select>

<input
className="atom-input"
style={{ minWidth: 200 }}
placeholder="Value (user id / ip / machine id)"
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
<select
className="atom-input"
value={newDuration}
onChange={(e) => setNewDuration(Number(e.target.value))}
style={{ width: 180 }}
>
{BAN_DURATION_OPTIONS.map((option) => (
<option key={option.value} value={option.value}>{option.label}</option>
))}
</select>
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
<td>{r.bantype === "account" ? "account" : r.bantype}</td>
<td>
<b>{getBanValue(r)}</b>
</td>
<td style={{ maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.reason}
</td>
<td>{fmtExpire(Number(r.expire))}</td>
<td>{fmtDate(Number(r.added_date))}</td>
<td>{r.added_by || "—"}</td>
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
Edit Ban #{editRow.id} ({editRow.bantype}:{getBanValue(editRow)})
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
<select
className="atom-input"
value={editDuration}
onChange={(e) => setEditDuration(Number(e.target.value))}
style={{ width: 220 }}
>
{BAN_DURATION_OPTIONS.map((option) => (
<option key={option.value} value={option.value}>{option.label}</option>
))}
</select>
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

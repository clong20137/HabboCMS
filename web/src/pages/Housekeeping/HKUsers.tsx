import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";

type Props = { me: any };

type HKUserListItem = {
  id: number;
  username: string;
  mail: string;
  rank: number;
  ip?: string | null; // server may return masked based on viewer rank
};

type HKUserDetail = Record<string, any> & {
  id: number;
  username: string;
  mail?: string | null;
  rank?: number | null;
  ip?: string | null; // alias from server, typically ip_last (masked as needed)
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

async function apiPatch<T>(url: string, body: any): Promise<T> {
  return hkRequest<T>(url.replace(/^\/api/, ""), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Turn "friend_bar_state" -> "Friend Bar State" */
function humanLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Mask display if empty */
function safeIp(ip: any) {
  const s = String(ip || "").trim();
  return s || "***.***.***.***";
}

/**
 * Editable fields you want shown in the UI.
 * This is the “everything” list, minus the stuff you said not to edit (ip/password/auth_ticket/etc).
 *
 * IMPORTANT: These must also be allowed on the server-side PATCH whitelist.
 */
const EDIT_FIELDS: Array<{
  key: string;
  type: "text" | "number" | "bool" | "enum";
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  section:
    | "Account"
    | "Appearance"
    | "Privacy"
    | "Moderation"
    | "Currency"
    | "Stats"
    | "Other";
}> = [
  // Account
  { key: "mail", type: "text", section: "Account" },
  { key: "rank", type: "number", min: 1, max: 7, step: 1, section: "Account" },
  {
    key: "rank_vip",
    type: "number",
    min: 0,
    max: 7,
    step: 1,
    section: "Account",
  },
  {
    key: "gender",
    type: "enum",
    section: "Account",
    options: [
      { value: "M", label: "M" },
      { value: "F", label: "F" },
    ],
  },

  // Appearance
  { key: "look", type: "text", section: "Appearance" },
  { key: "motto", type: "text", section: "Appearance" },
  {
    key: "bubble_id",
    type: "number",
    min: 0,
    max: 9999,
    step: 1,
    section: "Appearance",
  },

  // Privacy / Preferences
  { key: "hide_online", type: "bool", section: "Privacy" },
  { key: "hide_inroom", type: "bool", section: "Privacy" },
  { key: "block_newfriends", type: "bool", section: "Privacy" },
  { key: "ignore_invites", type: "bool", section: "Privacy" },
  {
    key: "friend_bar_state",
    type: "enum",
    section: "Privacy",
    options: [
      { value: "0", label: "Off" },
      { value: "1", label: "On" },
    ],
  },
  {
    key: "focus_preference",
    type: "number",
    min: 0,
    max: 10,
    step: 1,
    section: "Privacy",
  },
  {
    key: "chat_preference",
    type: "number",
    min: 0,
    max: 10,
    step: 1,
    section: "Privacy",
  },

  // Moderation-ish flags
  { key: "is_muted", type: "bool", section: "Moderation" },
  { key: "pets_muted", type: "bool", section: "Moderation" },
  { key: "bots_muted", type: "bool", section: "Moderation" },
  { key: "advertising_report_blocked", type: "bool", section: "Moderation" },
  { key: "disable_forced_effects", type: "bool", section: "Moderation" },
  { key: "allow_mimic", type: "bool", section: "Moderation" },
  { key: "allow_gifts", type: "bool", section: "Moderation" },
  { key: "trading_locked", type: "bool", section: "Moderation" },
  { key: "is_ambassador", type: "bool", section: "Moderation" },
  {
    key: "time_muted",
    type: "number",
    min: 0,
    max: 999999999,
    step: 1,
    section: "Moderation",
  },

  // Currency
  {
    key: "credits",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Currency",
  },
  {
    key: "vip_points",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Currency",
  },
  {
    key: "activity_points",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Currency",
  },
  {
    key: "bank_amount",
    type: "number",
    min: 0,
    max: 999999999999,
    step: 1,
    section: "Currency",
  },
  {
    key: "gotw_points",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Currency",
  },

  // Stats
  {
    key: "kills",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "deaths",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "punches_thrown",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "punches_received",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "arrests_made",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "arrests_amount",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "damage_dealt",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "damage_received",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Stats",
  },
  {
    key: "kd",
    type: "number",
    min: 0,
    max: 999999,
    step: 0.01,
    section: "Stats",
  },

  // Health / Energy
  {
    key: "health",
    type: "number",
    min: 0,
    max: 999999,
    step: 1,
    section: "Other",
  },
  {
    key: "max_health",
    type: "number",
    min: 0,
    max: 999999,
    step: 1,
    section: "Other",
  },
  {
    key: "energy",
    type: "number",
    min: 0,
    max: 999999,
    step: 1,
    section: "Other",
  },
  {
    key: "max_energy",
    type: "number",
    min: 0,
    max: 999999,
    step: 1,
    section: "Other",
  },

  // Misc
  {
    key: "home_room",
    type: "number",
    min: 0,
    max: 2147483647,
    step: 1,
    section: "Other",
  },
  { key: "vip", type: "bool", section: "Other" },
  { key: "volume", type: "text", section: "Other" },
];

function normalizeBool(v: any) {
  return v === true || v === 1 || v === "1";
}

export default function HKUsers({ me }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<HKUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<HKUserListItem | null>(null);
  const [detail, setDetail] = useState<HKUserDetail | null>(null);

  const [form, setForm] = useState<Record<string, any>>({});
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const myRank = Number(me?.user?.rank ?? me?.rank ?? 0);
  const shouldBlurIp = myRank <= 6;

  const ipStyle = useMemo<React.CSSProperties>(() => {
    if (!shouldBlurIp) return {};
    return { filter: "blur(6px)", userSelect: "none", pointerEvents: "none" };
  }, [shouldBlurIp]);

  const fieldsBySection = useMemo(() => {
    const out: Record<string, typeof EDIT_FIELDS> = {};
    for (const f of EDIT_FIELDS) {
      if (!out[f.section]) out[f.section] = [];
      out[f.section].push(f);
    }
    return out;
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setSaveMsg("");
      const url = q.trim()
        ? `/api/hk/users?q=${encodeURIComponent(q.trim())}`
        : `/api/hk/users`;
      const data = await apiGet<{ ok: boolean; items: HKUserListItem[] }>(url);
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(u: HKUserListItem) {
    setSelected(u);
    setSaveMsg("");
    setDetail(null);
    setForm({});
    setLoadingDetail(true);

    try {
      const data = await apiGet<{ ok: boolean; user: HKUserDetail }>(
        `/api/hk/users/${u.id}`,
      );

      const user = data.user;
      setDetail(user);

      // build form defaults from returned user
      const nextForm: Record<string, any> = {};
      for (const f of EDIT_FIELDS) {
        const raw = user[f.key];
        if (f.type === "bool") nextForm[f.key] = normalizeBool(raw);
        else if (f.type === "number") nextForm[f.key] = raw ?? 0;
        else nextForm[f.key] = raw ?? "";
      }
      setForm(nextForm);
    } catch (e: any) {
      setSaveMsg(e?.message || "Failed to load user details");
    } finally {
      setLoadingDetail(false);
    }
  }

  function setField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function diffPayload() {
    if (!detail) return {};

    const payload: Record<string, any> = {};

    for (const f of EDIT_FIELDS) {
      const before = detail[f.key];
      const after = form[f.key];

      if (f.type === "bool") {
        const b1 = normalizeBool(before);
        const b2 = normalizeBool(after);
        if (b1 !== b2) payload[f.key] = b2 ? 1 : 0;
        continue;
      }

      if (f.type === "number") {
        const n1 = before == null ? null : Number(before);
        const n2 = after == null || after === "" ? null : Number(after);
        if ((n1 ?? null) !== (n2 ?? null) && Number.isFinite(n2 as any)) {
          payload[f.key] = n2;
        }
        continue;
      }

      // text/enum
      const s1 = before == null ? "" : String(before);
      const s2 = after == null ? "" : String(after);
      if (s1 !== s2) payload[f.key] = s2;
    }

    // extra safety: never allow editing these from UI even if added accidentally
    delete payload.password;
    delete payload.auth_ticket;
    delete payload.ip_last;
    delete payload.ip_reg;
    delete payload.machine_id;
    delete payload.totp_secret;
    delete payload.totp_backup_codes;

    return payload;
  }

  async function save() {
    if (!selected || !detail) return;

    try {
      setSaveMsg("");
      setSaving(true);

      const payload = diffPayload();

      // enforce rank rules client-side (server must enforce too)
      if (payload.rank != null) {
        const newRank = Number(payload.rank);
        if (newRank >= myRank) {
          setSaveMsg("You cannot set rank ≥ your rank.");
          return;
        }
      }

      if (!Object.keys(payload).length) {
        setSaveMsg("No changes to save.");
        return;
      }

      await apiPatch(`/api/hk/users/${selected.id}`, payload);
      setSaveMsg("Saved.");

      await load();

      // reload detail so form matches DB
      await pick(selected);
    } catch (e: any) {
      setSaveMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function renderField(f: (typeof EDIT_FIELDS)[number]) {
    const v = form[f.key];

    // Rank hint (same message you already had)
    const isRankField = f.key === "rank";
    const rankHint = isRankField ? (
      <div style={{ fontWeight: 700, opacity: 0.95, marginTop: 6 }}>
        You are Rank {myRank}. You cannot set rank ≥ your rank.
      </div>
    ) : null;

    // booleans
    if (f.type === "bool") {
      const checked = !!v;
      return (
        <div className="hk-field" key={f.key}>
          <div className="hk-label">{humanLabel(f.key)}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setField(f.key, e.target.checked)}
            />
            <span style={{ fontWeight: 800 }}>
              {checked ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>
      );
    }

    // enums
    if (f.type === "enum") {
      return (
        <div className="hk-field" key={f.key}>
          <div className="hk-label">{humanLabel(f.key)}</div>
          <select
            className="hk-input"
            value={String(v ?? "")}
            onChange={(e) => setField(f.key, e.target.value)}
          >
            {(f.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {rankHint}
        </div>
      );
    }

    // numbers
    if (f.type === "number") {
      return (
        <div className="hk-field" key={f.key}>
          <div className="hk-label">{humanLabel(f.key)}</div>
          <input
            className="hk-input"
            type="number"
            min={f.min}
            max={f.max}
            step={f.step ?? 1}
            value={v ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              setField(f.key, raw === "" ? "" : Number(raw));
            }}
          />
          {rankHint}
        </div>
      );
    }

    // text
    return (
      <div className="hk-field" key={f.key}>
        <div className="hk-label">{humanLabel(f.key)}</div>
        <input
          className="hk-input"
          value={String(v ?? "")}
          onChange={(e) => setField(f.key, e.target.value)}
        />
        {rankHint}
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">USERS</div>
        <div className="panel-body">
          <div className="hk-row">
            <div className="hk-field">
              <div className="hk-label">Search username or email</div>
              <input
                className="hk-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Caleb"
              />
            </div>

            <div className="hk-actions">
              <button className="btn primary" onClick={load} disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setQ("");
                  setSelected(null);
                  setDetail(null);
                  setSaveMsg("");
                  load();
                }}
              >
                Clear
              </button>
            </div>

            {error && (
              <div style={{ fontWeight: 800, color: "#fff" }}>{error}</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">RESULTS</div>
        <div className="panel-body">
          <div className="hk-list">
            {items.map((u) => (
              <div key={u.id} className="hk-item">
                <div>
                  <div className="hk-item-title">{u.username}</div>

                  <div className="hk-item-sub">
                    ID {u.id} • Rank {u.rank} • {u.mail || "No email"}
                  </div>

                  {/* IP row */}
                  <div className="hk-item-sub" style={{ marginTop: 4 }}>
                    IP:{" "}
                    <span style={ipStyle} title={shouldBlurIp ? "Hidden" : ""}>
                      {safeIp(u.ip)}
                    </span>
                    {shouldBlurIp && (
                      <span style={{ marginLeft: 8, opacity: 0.85 }}>
                        (Hidden for Rank ≤ 6)
                      </span>
                    )}
                  </div>
                </div>

                <div className="hk-right">
                  <button className="btn" onClick={() => pick(u)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
            {!items.length && (
              <div style={{ fontWeight: 800 }}>No results.</div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-head">EDIT USER: {selected.username}</div>
          <div className="panel-body">
            {loadingDetail && (
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Loading user…
              </div>
            )}

            {/* IP display (read-only) */}
            <div className="hk-row" style={{ marginBottom: 12 }}>
              <div className="hk-field" style={{ flex: 1 }}>
                <div className="hk-label">Last Known IP</div>
                <div
                  className="hk-input"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 38,
                    padding: "0 10px",
                    opacity: 0.98,
                  }}
                >
                  <span style={ipStyle}>
                    {safeIp(detail?.ip ?? selected.ip)}
                  </span>
                  {shouldBlurIp && (
                    <span style={{ marginLeft: 8, opacity: 0.85 }}>
                      (Hidden)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable fields grouped */}
            {Object.entries(fieldsBySection).map(([sectionName, fields]) => (
              <div key={sectionName} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  {sectionName}
                </div>

                <div
                  className="hk-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  {fields.map(renderField)}
                </div>
              </div>
            ))}

            <div className="hk-actions" style={{ marginTop: 10 }}>
              <button
                className="btn primary"
                onClick={save}
                disabled={saving || loadingDetail}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                  setForm({});
                  setSaveMsg("");
                }}
                disabled={saving}
              >
                Close
              </button>

              {saveMsg && (
                <div style={{ fontWeight: 900, marginLeft: 6 }}>{saveMsg}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

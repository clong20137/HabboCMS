import { useEffect, useMemo, useState } from "react";

type Props = { me: any };

type SettingItem = {
  key: string;
  value: string;
  updatedAt: string;
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

async function apiPut<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

function formatSettingLabel(key: string): string {
  return key
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function HKSettings(_props: Props) {
  // =========================
  // GENERAL SITE SETTINGS (existing)
  // =========================
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");

  const [keyName, setKeyName] = useState("");
  const [val, setVal] = useState("");

  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);

  const [newBetaKey, setNewBetaKey] = useState("");
  const [betaKeyLoading, setBetaKeyLoading] = useState(false);

  const [hotelName, setHotelName] = useState("");
  const [hotelNameLoading, setHotelNameLoading] = useState(false);

  // =========================
  // SERVER SETTINGS (new panel)
  // =========================
  const [serverItems, setServerItems] = useState<SettingItem[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverSavingKey, setServerSavingKey] = useState<string | null>(null);

  const myRank = Number(_props?.me?.user?.rank ?? _props?.me?.rank ?? 0);
  const canEditHotelName = myRank >= 7;
  const canEditServerSettings = myRank >= 7;

  // (kept for compatibility if you were using them)
  const betaFromItems = useMemo(() => {
    const found = items.find((x) => x.key === "beta_mode_enabled");
    if (!found) return null;
    return String(found.value) === "1";
  }, [items]);

  const hotelNameFromItems = useMemo(() => {
    const found = items.find((x) => x.key === "hotel_name");
    if (!found) return "";
    return String(found.value ?? "");
  }, [items]);

  async function load() {
    setLoading(true);
    setServerLoading(true);

    try {
      const [generalRes, serverRes] = await Promise.allSettled([
        apiGet<{ ok: boolean; items: SettingItem[] }>("/api/hk/settings"),
        apiGet<{ ok: boolean; items: SettingItem[] }>(
          "/api/hk/server-settings",
        ),
      ]);

      // ---- General settings
      if (generalRes.status === "fulfilled") {
        const list = generalRes.value.items || [];
        setItems(list);

        try {
          const beta = await apiGet<{ ok: true; enabled: boolean }>(
            "/api/hk/settings/beta-mode",
          );
          setBetaEnabled(!!beta.enabled);
        } catch {
          const found = list.find((x) => x.key === "beta_mode_enabled");
          if (found) setBetaEnabled(String(found.value) === "1");
        }

        const hn = list.find((x) => x.key === "hotel_name");
        if (hn) setHotelName(String(hn.value ?? ""));
        else setHotelName("");
      } else {
        // if general settings fails, still let server settings load
        console.error("HK settings load failed:", generalRes.reason);
      }

      // ---- Server settings
      if (serverRes.status === "fulfilled") {
        setServerItems(serverRes.value.items || []);
      } else {
        console.error("HK server settings load failed:", serverRes.reason);
        // Don't hard fail whole page; just show message.
      }
    } finally {
      setLoading(false);
      setServerLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    try {
      setMsg("");
      const k = keyName.trim();
      if (!k) return setMsg("Key is required.");

      await apiPut(`/api/hk/settings/${encodeURIComponent(k)}`, { value: val });

      setMsg("Saved.");
      setKeyName("");
      setVal("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    }
  }

  async function toggleBetaMode() {
    try {
      setMsg("");
      setBetaLoading(true);

      const next = !betaEnabled;
      setBetaEnabled(next); // optimistic UI

      // Preferred: dedicated endpoint
      try {
        await apiPost<{ ok: true; enabled: boolean }>(
          "/api/hk/settings/beta-mode",
          { enabled: next },
        );
      } catch {
        // Fallback: existing generic setting PUT route
        await apiPut("/api/hk/settings/beta_mode_enabled", {
          value: next ? "1" : "0",
        });
      }

      setMsg(`Beta mode turned ${next ? "ON" : "OFF"}.`);
      await load();
    } catch (e: any) {
      setBetaEnabled((v) => !v); // revert
      setMsg(e?.message || "Failed to toggle beta mode");
    } finally {
      setBetaLoading(false);
    }
  }

  async function addBetaKey() {
    try {
      setMsg("");
      const code = newBetaKey.trim();
      if (!code) return setMsg("Please enter a beta key.");
      if (code.length < 4) return setMsg("Beta key must be at least 4 chars.");

      setBetaKeyLoading(true);

      await apiPost<{ ok: true; code?: string }>("/api/hk/settings/beta-keys", {
        code,
      });

      setMsg("Beta key created.");
      setNewBetaKey("");
    } catch (e: any) {
      setMsg(e?.message || "Failed to create beta key");
    } finally {
      setBetaKeyLoading(false);
    }
  }

  async function saveHotelName() {
    try {
      setMsg("");

      if (!canEditHotelName) {
        return setMsg("Only Rank 7 can edit Hotel Name.");
      }

      const v = hotelName.trim();
      if (!v) return setMsg("Hotel Name is required.");
      if (v.length > 50)
        return setMsg("Hotel Name must be 50 characters or less.");

      setHotelNameLoading(true);

      await apiPut("/api/hk/settings/hotel_name", { value: v });

      setMsg("Hotel Name saved.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save Hotel Name");
    } finally {
      setHotelNameLoading(false);
    }
  }

  // =========================
  // SERVER SETTINGS save
  // =========================
  async function saveServerSetting(key: string, value: string) {
    try {
      setMsg("");

      if (!canEditServerSettings) {
        return setMsg("Only Rank 7 can edit Server Settings.");
      }

      setServerSavingKey(key);

      // GET /api/hk/server-settings
      // PUT /api/hk/server-settings/:key { value }
      await apiPut(`/api/hk/server-settings/${encodeURIComponent(key)}`, {
        value,
      });

      setMsg(`${formatSettingLabel(key)} saved.`);
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save server setting");
    } finally {
      setServerSavingKey(null);
    }
  }

  return (
    <>
      
      <div className="panel">
        <div className="panel-head">General Site Settings</div>
        <div className="panel-body">
          {/* Row 1: Beta toggle */}
          <div
            className="hk-settingRow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Beta Only Registration
              </div>
              <div className="hk-item-sub" style={{ marginTop: 4 }}>
                When enabled, users must enter a valid beta code to register.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className={`hk-toggle ${betaEnabled ? "is-on" : "is-off"}`}
                onClick={toggleBetaMode}
                disabled={betaLoading}
                title="Toggle beta-only registration"
                style={{
                  minWidth: 96,
                  padding: "8px 14px",
                  fontWeight: 900,
                  borderRadius: 6,
                  border: "none",
                  cursor: betaLoading ? "not-allowed" : "pointer",
                }}
              >
                {betaLoading ? "Saving..." : betaEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {/* Row 2: Create beta key */}
          <div
            className="hk-settingRow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 18,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Create Beta Key
              </div>
              <div className="hk-item-sub" style={{ marginTop: 4 }}>
                Add a new beta key users can use to register during beta-only
                mode.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-end",
                flexShrink: 0,
              }}
            >
              <input
                className="hk-input"
                value={newBetaKey}
                onChange={(e) => setNewBetaKey(e.target.value)}
                placeholder="ENTER-KEY-123"
                disabled={betaKeyLoading}
                style={{ width: 220 }}
              />
              <button
                className="btn btn-primary"
                onClick={addBetaKey}
                disabled={betaKeyLoading || newBetaKey.trim().length < 4}
                style={{ whiteSpace: "nowrap" }}
              >
                {betaKeyLoading ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {/* Row 3: Hotel Name */}
          <div
            className="hk-settingRow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 18,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Hotel Name</div>
              <div className="hk-item-sub" style={{ marginTop: 4 }}>
                Updates the prefix used in page titles.
              </div>
              {!canEditHotelName && (
                <div
                  className="hk-item-sub"
                  style={{ marginTop: 6, opacity: 0.85 }}
                >
                  <b>Rank 7 only</b> can edit this setting.
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-end",
                flexShrink: 0,
              }}
            >
              <input
                className="hk-input"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="PlusCMS Hotel"
                disabled={!canEditHotelName || hotelNameLoading}
                style={{ width: 220 }}
              />
              <button
                className="btn btn-primary"
                onClick={saveHotelName}
                disabled={
                  !canEditHotelName || hotelNameLoading || !hotelName.trim()
                }
                style={{ whiteSpace: "nowrap" }}
                title={!canEditHotelName ? "Rank 7 only" : "Save Hotel Name"}
              >
                {hotelNameLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Optional: generic key/value editor (if you still want it) */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              Raw Setting Editor
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="hk-input"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="setting_key"
                disabled={loading}
                style={{ width: 220 }}
              />
              <input
                className="hk-input"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder="value"
                disabled={loading}
                style={{ width: 260 }}
              />
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={loading}
              >
                Save
              </button>
            </div>
          </div>

          {msg && <div style={{ fontWeight: 900, marginTop: 14 }}>{msg}</div>}
        </div>
      </div>

      
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">Server Settings</div>
        <div className="panel-body">
          {!canEditServerSettings && (
            <div
              className="hk-item-sub"
              style={{ marginBottom: 10, opacity: 0.9 }}
            >
              <b>Rank 7 only</b> can edit server settings.
            </div>
          )}

          {serverLoading ? (
            <div className="muted">Loading server settings...</div>
          ) : serverItems.length === 0 ? (
            <div className="muted">No server settings found.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {serverItems.map((it) => {
                const savingThis = serverSavingKey === it.key;

                return (
                  <div
                    key={it.key}
                    className="hk-settingRow"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* LEFT: pretty label + raw key */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {formatSettingLabel(it.key)}
                      </div>
                      <div className="hk-item-sub" style={{ marginTop: 4 }}>
                        Key: <span style={{ opacity: 0.9 }}>{it.key}</span>
                        {it.updatedAt ? (
                          <>
                            {" "}
                            • Updated:{" "}
                            <span style={{ opacity: 0.9 }}>{it.updatedAt}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* RIGHT: editor + save */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: "flex-end",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        className="hk-input"
                        value={it.value ?? ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          setServerItems((prev) =>
                            prev.map((x) =>
                              x.key === it.key ? { ...x, value: next } : x,
                            ),
                          );
                        }}
                        disabled={!canEditServerSettings || savingThis}
                        style={{ width: 260 }}
                      />

                      <button
                        className="btn btn-primary"
                        disabled={!canEditServerSettings || savingThis}
                        onClick={() =>
                          saveServerSetting(it.key, String(it.value ?? ""))
                        }
                        style={{ whiteSpace: "nowrap" }}
                        title={
                          !canEditServerSettings
                            ? "Rank 7 only"
                            : "Save setting"
                        }
                      >
                        {savingThis ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {msg && <div style={{ fontWeight: 900, marginTop: 14 }}>{msg}</div>}
        </div>
      </div>
    </>
  );
}

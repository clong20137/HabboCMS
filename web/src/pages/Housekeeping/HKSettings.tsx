import { hkRequest } from "../../api/hkApi";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ui/toast/ToastContext";

type Props = { me: any };

type SettingItem = {
  key: string;
  value: string;
  updatedAt?: string;
  description?: string;
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      (data as any)?.error || (data as any)?.message || "Request failed",
    );
  return data as T;
}

async function apiPut<T>(url: string, body: any): Promise<T> {
  return hkRequest<T>(url.replace(/^\/api/, ""), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  return hkRequest<T>(url.replace(/^\/api/, ""), {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export default function HKSettings(props: Props) {
  const { showToast } = useToast();

  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [keyName, setKeyName] = useState("");
  const [val, setVal] = useState("");

  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);

  const [newBetaKey, setNewBetaKey] = useState("");
  const [betaKeyLoading, setBetaKeyLoading] = useState(false);

  const [hotelName, setHotelName] = useState("");
  const [hotelNameLoading, setHotelNameLoading] = useState(false);

  const [discordInvite, setDiscordInvite] = useState("");
  const [discordLoading, setDiscordLoading] = useState(false);

  const [serverItems, setServerItems] = useState<SettingItem[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverSavingKey, setServerSavingKey] = useState<string | null>(null);

  const myRank = Number(props?.me?.user?.rank ?? props?.me?.rank ?? 0);
  const canEditHotelName = myRank >= 7;
  const canEditServerSettings = myRank >= 7;

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
          else if (betaFromItems !== null) setBetaEnabled(!!betaFromItems);
        }

        const hn = list.find((x) => x.key === "hotel_name");
        if (hn) setHotelName(String(hn.value ?? ""));
        else if (hotelNameFromItems) setHotelName(hotelNameFromItems);
        else setHotelName("");

        const discord = list.find((x) => x.key === "discord_invite");
        if (discord) setDiscordInvite(String(discord.value ?? ""));
        else setDiscordInvite("");
      } else {
        console.error("HK settings load failed:", generalRes.reason);
        showToast("Failed to load general settings.", "error");
      }

      if (serverRes.status === "fulfilled") {
        setServerItems(serverRes.value.items || []);
      } else {
        console.error("HK server settings load failed:", serverRes.reason);
        showToast("Failed to load server settings.", "error");
      }
    } finally {
      setLoading(false);
      setServerLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      const k = keyName.trim();
      if (!k) {
        showToast("Key is required.", "warning");
        return;
      }

      await apiPut(`/api/hk/settings/${encodeURIComponent(k)}`, { value: val });

      setKeyName("");
      setVal("");
      await load();
      showToast("Setting saved.", "success");
    } catch (e: any) {
      showToast(e?.message || "Save failed", "error");
    }
  }

  async function toggleBetaMode() {
    try {
      setBetaLoading(true);

      const next = !betaEnabled;
      setBetaEnabled(next);

      try {
        await apiPost<{ ok: true; enabled: boolean }>(
          "/api/hk/settings/beta-mode",
          { enabled: next },
        );
      } catch {
        await apiPut("/api/hk/settings/beta_mode_enabled", {
          value: next ? "1" : "0",
        });
      }

      await load();
      showToast(`Beta mode turned ${next ? "ON" : "OFF"}.`, "success");
    } catch (e: any) {
      setBetaEnabled((v) => !v);
      showToast(e?.message || "Failed to toggle beta mode", "error");
    } finally {
      setBetaLoading(false);
    }
  }

  async function addBetaKey() {
    try {
      const code = newBetaKey.trim();

      if (!code) {
        showToast("Please enter a beta key.", "warning");
        return;
      }

      if (code.length < 4) {
        showToast("Beta key must be at least 4 characters.", "warning");
        return;
      }

      setBetaKeyLoading(true);

      await apiPost<{ ok: true; code?: string }>("/api/hk/settings/beta-keys", {
        code,
      });

      setNewBetaKey("");
      showToast("Beta key created.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to create beta key", "error");
    } finally {
      setBetaKeyLoading(false);
    }
  }

  async function saveHotelName() {
    try {
      if (!canEditHotelName) {
        showToast("Only Rank 7 can edit Hotel Name.", "warning");
        return;
      }

      const v = hotelName.trim();

      if (!v) {
        showToast("Hotel Name is required.", "warning");
        return;
      }

      if (v.length > 50) {
        showToast("Hotel Name must be 50 characters or less.", "warning");
        return;
      }

      setHotelNameLoading(true);

      await apiPut("/api/hk/settings/hotel_name", { value: v });

      await load();
      showToast("Hotel Name saved.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to save Hotel Name", "error");
    } finally {
      setHotelNameLoading(false);
    }
  }

  async function saveDiscordInvite() {
    try {
      if (!canEditHotelName) {
        showToast("Only Rank 7 can edit Discord Invite.", "warning");
        return;
      }

      const v = discordInvite.trim();

      if (!v) {
        showToast("Discord Invite is required.", "warning");
        return;
      }

      setDiscordLoading(true);

      await apiPut("/api/hk/settings/discord_invite", { value: v });

      await load();
      showToast("Discord Invite saved.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to save Discord Invite", "error");
    } finally {
      setDiscordLoading(false);
    }
  }

  async function saveServerSetting(key: string, value: string) {
    try {
      if (!canEditServerSettings) {
        showToast("Only Rank 7 can edit Server Settings.", "warning");
        return;
      }

      setServerSavingKey(key);

      await apiPut(`/api/hk/server-settings/${encodeURIComponent(key)}`, {
        value,
      });

      await load();
      showToast(`${formatSettingLabel(key)} saved.`, "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to save server setting", "error");
    } finally {
      setServerSavingKey(null);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">General Site Settings</div>

        <div className="panel-body">
          <div className="hk-settingRow">
            <div className="hk-settingInfo">
              <div className="hk-settingTitle">Beta Only Registration</div>
              <div className="hk-settingDesc">
                When enabled, users must enter a valid beta code to register.
              </div>
            </div>

            <div className="hk-settingAction">
              <button
                className={`hk-toggle ${betaEnabled ? "is-on" : "is-off"}`}
                onClick={toggleBetaMode}
                disabled={betaLoading}
                title="Toggle beta-only registration"
              >
                {betaLoading ? "Saving..." : betaEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div className="hk-settingRow">
            <div className="hk-settingInfo">
              <div className="hk-settingTitle">Create Beta Key</div>
              <div className="hk-settingDesc">
                Add a new beta key users can use during beta-only mode.
              </div>
            </div>

            <div
              className="hk-settingAction"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
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
              >
                {betaKeyLoading ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          <div className="hk-settingRow">
            <div className="hk-settingInfo">
              <div className="hk-settingTitle">Hotel Name</div>
              <div className="hk-settingDesc">
                Updates the prefix used in page titles.
              </div>
              {!canEditHotelName && (
                <div className="hk-settingDesc">
                  <b>Rank 7 only</b> can edit this setting.
                </div>
              )}
            </div>

            <div
              className="hk-settingAction"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
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
              >
                {hotelNameLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="hk-settingRow">
            <div className="hk-settingInfo">
              <div className="hk-settingTitle">Discord Channel</div>
              <div className="hk-settingDesc">
                Saves the Discord invite/channel link used on the Me page.
              </div>
              {!canEditHotelName && (
                <div className="hk-settingDesc">
                  <b>Rank 7 only</b> can edit this setting.
                </div>
              )}
            </div>

            <div
              className="hk-settingAction"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <input
                className="hk-input"
                value={discordInvite}
                onChange={(e) => setDiscordInvite(e.target.value)}
                placeholder="https://discord.gg/yourinvite"
                disabled={!canEditHotelName || discordLoading}
                style={{ width: 320 }}
              />
              <button
                className="btn btn-primary"
                onClick={saveDiscordInvite}
                disabled={
                  !canEditHotelName || discordLoading || !discordInvite.trim()
                }
              >
                {discordLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              Raw Setting Editor
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
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
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">Server Settings</div>

        <div className="panel-body">
          {!canEditServerSettings && (
            <div className="hk-settingDesc" style={{ marginBottom: 10 }}>
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
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="hk-settingInfo">
                      <div className="hk-settingTitle">
                        {formatSettingLabel(it.key)}
                      </div>
                      <div className="hk-settingDesc">
                        Key: <span>{it.key}</span>
                        {it.description ? (
                          <>
                            {" "}
                            • <span>{it.description}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="hk-settingAction"
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
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
                      >
                        {savingThis ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

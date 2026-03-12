import { useEffect, useState } from "react";
import { useToast } from "../../ui/toast/ToastContext";

type Props = { me: any };

type AuditItem = {
  id: number;
  actorName: string;
  actorRank: number;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  createdAt: string;
  details?: any;
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || (data as any)?.message || "Request failed");
  return data as T;
}

export default function HKAuditLog(_props: Props) {
  const { showToast } = useToast();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const data = await apiGet<{ ok: boolean; items: AuditItem[] }>("/api/hk/audit");
        setItems(data.items || []);
      } catch (e: any) {
        const msg = e?.message || "Audit endpoint not added yet.";
        setError(msg);
        showToast(msg, "error");
      }
    })();
  }, [showToast]);

  return (
    <div className="panel">
      <div className="panel-head">AUDIT LOG</div>
      <div className="panel-body">
        {error && (
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            {error}
            <div style={{ fontWeight: 700, opacity: 0.95, marginTop: 6 }}>
              Next step: add the backend route <code>/api/hk/audit</code>.
            </div>
          </div>
        )}

        <div className="hk-list">
          {items.map((a) => (
            <div key={a.id} className="hk-item" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div className="hk-item-title">
                    {a.action} • {a.actorName} (Rank {a.actorRank})
                  </div>
                  <div className="hk-item-sub">
                    {a.targetType ? `${a.targetType}:${a.targetId}` : "—"} • {a.createdAt} • {a.ip || "—"}
                  </div>
                </div>
                <div className="hk-right">
                  <button
                    className="btn"
                    onClick={() => setOpenId((prev) => (prev === a.id ? null : a.id))}
                  >
                    {openId === a.id ? "Hide Details" : "Details"}
                  </button>
                </div>
              </div>
              {openId === a.id && (
                <pre style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.08)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(a.details || {}, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {!items.length && !error && <div style={{ fontWeight: 800 }}>No audit entries.</div>}
        </div>
      </div>
    </div>
  );
}

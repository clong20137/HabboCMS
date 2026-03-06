import { useEffect, useState } from "react";

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
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

export default function HKAuditLog(_props: Props) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // NOTE: you'll add /api/hk/audit soon. This page is ready.
    (async () => {
      try {
        setError("");
        const data = await apiGet<{ ok: boolean; items: AuditItem[] }>(
          "/api/hk/audit",
        );
        setItems(data.items || []);
      } catch (e: any) {
        setError(e?.message || "Audit endpoint not added yet.");
      }
    })();
  }, []);

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
            <div key={a.id} className="hk-item">
              <div>
                <div className="hk-item-title">
                  {a.action} • {a.actorName} (Rank {a.actorRank})
                </div>
                <div className="hk-item-sub">
                  {a.targetType ? `${a.targetType}:${a.targetId}` : "—"} •{" "}
                  {a.createdAt} • {a.ip || "—"}
                </div>
              </div>
              <div className="hk-right">
                <button
                  className="btn"
                  onClick={() =>
                    alert(JSON.stringify(a.details || {}, null, 2))
                  }
                >
                  Details
                </button>
              </div>
            </div>
          ))}
          {!items.length && !error && (
            <div style={{ fontWeight: 800 }}>No audit entries.</div>
          )}
        </div>
      </div>
    </div>
  );
}

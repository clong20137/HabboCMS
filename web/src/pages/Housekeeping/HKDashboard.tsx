type Props = {
  me: any;
};

export default function HKDashboard({ me }: Props) {
  const perms: string[] = me?.permissions || [];

  return (
    <div className="panel">
      <div className="panel-head">HOUSEKEEPING DASHBOARD</div>
      <div className="panel-body">
        <div className="hk-row">
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              Welcome, {me?.user?.username}
            </div>
            <div style={{ fontWeight: 700, opacity: 0.95, marginTop: 6 }}>
              Rank {me?.user?.rank} • Permissions loaded from backend
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="hk-label">Your Permissions</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {perms.map((p) => (
                <span
                  key={p}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 12,
                    background: "rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#fff",
                  }}
                >
                  {p}
                </span>
              ))}
              {!perms.length && (
                <div style={{ fontWeight: 800 }}>No permissions returned.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

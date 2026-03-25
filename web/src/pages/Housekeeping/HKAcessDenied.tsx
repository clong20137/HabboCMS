export default function HKAccessDenied({ message }: { message: string }) {
  return (
    <div className="panel">
      <div className="panel-head">HOUSEKEEPING</div>
      <div className="panel-body">
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
          Access Denied
        </div>
        <div style={{ fontWeight: 700, opacity: 0.95 }}>{message}</div>
      </div>
    </div>
  );
}

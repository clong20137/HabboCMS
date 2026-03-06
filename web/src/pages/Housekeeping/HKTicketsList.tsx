import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type TicketStatus = "open" | "pending" | "closed";

type TicketListItem = {
  id: number;
  userId: number;
  username: string;
  type: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};

type ListResp = {
  ok: true;
  total: number;
  items: TicketListItem[];
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

function fmtDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function HKTicketsList() {
  const location = useLocation();

  const [items, setItems] = useState<TicketListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState<"open" | "pending" | "closed" | "all">(
    "open",
  );
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const usp = new URLSearchParams();
    usp.set("status", status);
    if (q.trim()) usp.set("q", q.trim());
    usp.set("limit", "100");
    usp.set("offset", "0");
    return usp.toString();
  }, [status, q]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await apiGet<ListResp>(`/api/hk/tickets?${queryString}`);
      setItems(data.items || []);
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setErr(e?.message || "Failed to load tickets");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  return (
    <div className="panel hk-tickets">
      <div className="panel-head">
        <div className="panel-title">Support Tickets</div>
      </div>

      <div className="panel-body">
        {/* Toolbar */}
        <div className="hk-tickets__toolbar">
          <div className="hk-tickets__filters">
            {(["open", "pending", "closed", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`hk-ticketFilterBtn ${status === s ? "active" : ""}`}
                onClick={() => setStatus(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div />

          <div className="hk-tickets__search">
            <input
              className="hk-tickets__searchInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by username, type, or id..."
            />
            <button
              type="button"
              className="hk-tickets__searchBtn"
              onClick={load}
            >
              Search
            </button>
          </div>
        </div>

        <div className="hk-tickets__meta muted">
          Total: <b>{total}</b>
        </div>

        {loading ? (
          <div className="hk-tickets__state">Loading…</div>
        ) : err ? (
          <div className="hk-tickets__state hk-tickets__state--error">
            {err}
          </div>
        ) : items.length === 0 ? (
          <div className="hk-tickets__state">No tickets found.</div>
        ) : (
          <div className="hk-table hk-ticketsTableWrap">
            <div className="hk-table__row hk-table__row--head">
              <div>ID</div>
              <div>User</div>
              <div>Type</div>
              <div>Status</div>
              <div>Last Update</div>
              <div className="hk-table__actionsHead" />
            </div>

            {items.map((t) => (
              <div key={t.id} className="hk-table__row">
                <div className="hk-table__id">#{t.id}</div>

                <div className="hk-table__user">
                  <span className="hk-table__username">{t.username}</span>{" "}
                  <span className="muted">(#{t.userId})</span>
                </div>

                <div className="hk-table__type">{t.type}</div>

                <div>
                  <span
                    className={`hk-ticketStatus hk-ticketStatus--${t.status}`}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>

                <div className="hk-table__date">
                  {fmtDate(t.updatedAt || t.lastMessageAt)}
                </div>

                <div className="hk-ticketActions">
                  <Link
                    className="hk-ticketViewBtn"
                    to={`/housekeeping/tickets/${t.id}`}
                    state={{ from: location.pathname }}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type TicketStatus = "open" | "pending" | "closed";

type TicketDetail = {
  id: number;
  userId: number;
  username: string;
  type: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
};

type TicketMsg = {
  id: number;
  ticketId: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
};

type ReadResp = {
  ok: true;
  ticket: TicketDetail;
  messages: TicketMsg[];
};

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
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

async function apiPatch<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || data?.message || "Request failed");
  return data as T;
}

function fmtDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function HKTicketsView() {
  const nav = useNavigate();
  const { id } = useParams();
  const ticketId = useMemo(() => Number(id), [id]);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      setErr("Invalid ticket id.");
      setLoading(false);
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const data = await apiGet<ReadResp>(`/api/hk/tickets/${ticketId}`);
      setTicket(data.ticket);
      setMessages(data.messages || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load ticket");
      setTicket(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function sendReply(nextStatus?: TicketStatus) {
    const msg = reply.trim();
    if (!msg) return;

    setSending(true);
    setErr("");
    try {
      await apiPost(`/api/hk/tickets/${ticketId}/reply`, {
        message: msg,
        status: nextStatus || undefined,
      });
      setReply("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: TicketStatus) {
    setSending(true);
    setErr("");
    try {
      await apiPatch(`/api/hk/tickets/${ticketId}/status`, { status });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to update status");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Ticket #{ticketId}</div>
        </div>
        <div className="panel-body">Loading…</div>
      </div>
    );
  }

  if (err || !ticket) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Ticket</div>
        </div>
        <div className="panel-body">
          <div style={{ color: "#ff6b6b" }}>{err || "Ticket not found."}</div>
          <div style={{ marginTop: 10 }}>
            <Link to="/housekeeping/tickets" className="btn btn-primary">
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          Ticket #{ticket.id} — {ticket.type}
        </div>
      </div>

      <div className="panel-body">
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div className="muted">User</div>
            <div>
              <b>{ticket.username}</b>{" "}
              <span className="muted">(#{ticket.userId})</span>
            </div>
          </div>

          <div>
            <div className="muted">Status</div>
            <div>
              <span className={`hk-badge hk-badge--${ticket.status}`}>
                {ticket.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div>
            <div className="muted">Created</div>
            <div>{fmtDate(ticket.createdAt)}</div>
          </div>

          <div>
            <div className="muted">Updated</div>
            <div>{fmtDate(ticket.updatedAt)}</div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link to="/housekeeping/tickets" className="btn">
              Back
            </Link>

            {ticket.status !== "closed" ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending}
                onClick={() => setStatus("closed")}
              >
                Close
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending}
                onClick={() => setStatus("open")}
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        {err && <div style={{ marginTop: 12, color: "#ff6b6b" }}>{err}</div>}

        <div style={{ marginTop: 16 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Conversation
          </div>

          <div
            className="hk-ticket-thread"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className="hk-ticket-msg panel"
                style={{ padding: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <b>{m.username}</b>{" "}
                    <span className="muted">#{m.userId}</span>
                  </div>
                  <div className="muted">{fmtDate(m.createdAt)}</div>
                </div>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {m.message}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Reply
          </div>

          <textarea
            className="hk-input"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a staff response..."
            style={{ width: "100%", minHeight: 120 }}
            maxLength={2000}
          />

          <div
            style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}
          >
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending || !reply.trim()}
              onClick={() => sendReply("pending")}
            >
              Reply + Set Pending
            </button>

            <button
              type="button"
              className="btn"
              disabled={sending || !reply.trim()}
              onClick={() => sendReply()}
            >
              Reply (keep status)
            </button>

            {ticket.status !== "closed" && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={sending || !reply.trim()}
                onClick={() => sendReply("closed")}
              >
                Reply + Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

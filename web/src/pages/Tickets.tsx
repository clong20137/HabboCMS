import { useEffect, useMemo, useRef, useState } from "react";
import SiteLayout from "../components/layout/SiteLayout";
import "../styles/Tickets.scss";

import duckImg from "../assets/support/duck.png";
import infoImg from "../assets/support/info.png";
import ticketFrank from "../assets/support/frank_question.png";
import { useHotelTitle } from "../hooks/useHotelTitle";

import { api } from "../api/client";

type TicketType =
  | "Ban Appeal"
  | "Scam Report"
  | "VPN/Proxy Whitelist Request"
  | "Password Recovery"
  | "Store Payment Issue"
  | "Other";

type TicketStatus = "Open" | "Pending" | "Closed";

type Ticket = {
  id: number;
  type: TicketType;
  message: string; // original ticket message (first post)
  status: TicketStatus;
  createdAt: string;
};

type TicketMessage = {
  id: number;
  ticketId: number;
  senderType: "user" | "staff";
  senderName: string;
  message: string;
  createdAt: string;
};

const TICKET_TYPES: TicketType[] = [
  "Ban Appeal",
  "Scam Report",
  "VPN/Proxy Whitelist Request",
  "Password Recovery",
  "Store Payment Issue",
  "Other",
];

const GUIDELINES = [
  "Please provide as much detail as possible in your ticket",
  "Be patient - our staff will respond as soon as possible",
  "Do not create duplicate tickets for the same issue",
  "Be respectful and polite when communicating with staff",
  "Only create tickets for legitimate issues or requests",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const TRANSITION_MS = 260;

export default function Tickets() {
  useHotelTitle("Support Tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [view, setView] = useState<"list" | "create">("list");

  // smooth view transition
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  // list loading/error
  const [isLoading, setIsLoading] = useState(false);
  const [listErr, setListErr] = useState<string>("");

  // create form
  const [type, setType] = useState<TicketType | "">("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ticket conversation
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadErr, setThreadErr] = useState("");
  const [thread, setThread] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replyErr, setReplyErr] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const messageLen = message.trim().length;
  const canSubmit = !!type && messageLen >= 50 && messageLen <= 1000;

  const hasTickets = tickets.length > 0;

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return tickets.find((t) => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  function switchView(next: "list" | "create") {
    if (next === view) return;

    setErr("");
    setIsSwitching(true);

    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);

    switchTimerRef.current = window.setTimeout(() => {
      if (next === "create") {
        setType("");
        setMessage("");
        setSelectedTicketId(null);
        setThread([]);
        setReply("");
      }

      setView(next);
      setIsSwitching(false);
    }, TRANSITION_MS);
  }

  function openCreate() {
    switchView("create");
  }

  function goBackToList() {
    switchView("list");
  }

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    };
  }, []);

  async function loadTickets() {
    setListErr("");
    setIsLoading(true);
    try {
      const res = await (api as any).getMyTickets?.(50);

      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
          ? res.items
          : [];

      const normalized: Ticket[] = items.map((t: any) => ({
        id: Number(t.id),
        type: t.type as TicketType,
        message: String(t.message ?? ""),
        status: (t.status as TicketStatus) || "Open",
        createdAt: String(
          t.createdAt ?? t.created_at ?? new Date().toISOString(),
        ),
      }));

      setTickets(normalized);
    } catch (e: any) {
      setTickets([]);
      setListErr(e?.message || "Failed to load tickets.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeMessage(m: any, fallbackTicketId: number): TicketMessage {
   const senderTypeRaw = m?.is_staff ? "staff" : "user";

    const senderType: "user" | "staff" =
      senderTypeRaw === "staff" || senderTypeRaw === "user"
        ? senderTypeRaw
        : String(senderTypeRaw).toLowerCase() === "staff"
          ? "staff"
          : "user";

    return {
      id: Number(m?.id ?? Date.now()),
      ticketId: Number(m?.ticketId ?? m?.ticket_id ?? fallbackTicketId),
      senderType,
      senderName: String(
        m?.senderName ??
          m?.sender_name ??
          m?.username ??
          (senderType === "staff" ? "Staff" : "You"),
      ),
      message: String(m?.message ?? m?.body ?? ""),
      createdAt: String(
        m?.createdAt ?? m?.created_at ?? new Date().toISOString(),
      ),
    };
  }

  async function loadThread(ticketId: number) {
    setThreadErr("");
    setThreadLoading(true);

    try {
      const res = await (api as any).getTicketThread?.(ticketId);
      const messagesRaw =
        (Array.isArray(res) ? res : (res?.messages ?? res?.items)) || [];

      const normalized = (Array.isArray(messagesRaw) ? messagesRaw : [])
        .map((m: any) => normalizeMessage(m, ticketId))
        .sort(
          (a: TicketMessage, b: TicketMessage) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

      setThread(normalized);
    } catch (e: any) {
      setThread([]);
      setThreadErr(e?.message || "Failed to load ticket conversation.");
    } finally {
      setThreadLoading(false);
      window.setTimeout(
        () => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        40,
      );
    }
  }

  async function openTicket(ticketId: number) {
    setSelectedTicketId(ticketId);
    setReply("");
    setReplyErr("");
    await loadThread(ticketId);
  }

  async function submitTicket() {
    setErr("");

    if (isSubmitting) return;

    if (!type) return setErr("Please select a ticket type.");
    if (!TICKET_TYPES.includes(type as TicketType))
      return setErr("Invalid ticket type.");
    if (messageLen < 50)
      return setErr("Message must be at least 50 characters.");
    if (messageLen > 1000)
      return setErr("Message cannot exceed 1000 characters.");

    setIsSubmitting(true);
    try {
      const created = await (api as any).createTicket?.(
        type as TicketType,
        message.trim(),
      );

      const newTicket: Ticket = {
        id: Number(created?.id ?? Date.now()),
        type: (created?.type as TicketType) || (type as TicketType),
        message: String(created?.message ?? message.trim()),
        status: (created?.status as TicketStatus) || "Open",
        createdAt: String(
          created?.createdAt ?? created?.created_at ?? new Date().toISOString(),
        ),
      };

      setTickets((prev) => [newTicket, ...prev]);
      switchView("list");

      // auto-open the new ticket
      window.setTimeout(() => openTicket(newTicket.id), 0);
    } catch (e: any) {
      setErr(e?.message || "Failed to submit ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const replyLen = reply.trim().length;
  const canReply =
    !!selectedTicket &&
    selectedTicket.status !== "Closed" &&
    replyLen >= 1 &&
    replyLen <= 1000;

  async function sendReply() {
    setReplyErr("");
    if (!selectedTicket) return;
    if (isReplying) return;

    if (selectedTicket.status === "Closed") {
      return setReplyErr("This ticket is closed and cannot be replied to.");
    }
    if (replyLen < 1) return setReplyErr("Please type a message.");
    if (replyLen > 1000)
      return setReplyErr("Message cannot exceed 1000 characters.");

    setIsReplying(true);
    try {
      const res = await (api as any).postTicketMessage?.(
        selectedTicket.id,
        reply.trim(),
      );

      const createdMsg = res?.message ?? res ?? null;

      const next: TicketMessage =
        createdMsg && typeof createdMsg === "object"
          ? normalizeMessage(createdMsg, selectedTicket.id)
          : {
              id: Date.now(),
              ticketId: selectedTicket.id,
              senderType: "user",
              senderName: "You",
              message: reply.trim(),
              createdAt: new Date().toISOString(),
            };

      setThread((prev) => [...prev, next]);
      setReply("");

      window.setTimeout(
        () => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        20,
      );
    } catch (e: any) {
      setReplyErr(e?.message || "Failed to send reply.");
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <SiteLayout active="support">
      <div className="tickets-page">
        <div
          className={`tickets-switch ${isSwitching ? "is-switching" : ""}`}
          style={{ ["--tickets-ms" as any]: `${TRANSITION_MS}ms` }}
        >
          {view === "list" ? (
            <div className="tickets-grid">
              {/* LEFT: MY TICKETS */}
              <section className="panel tickets-panel">
                <div className="panel-head">MY TICKETS</div>
                <div className="panel-body tickets-body">
                  {isLoading ? (
                    <div className="muted">Loading tickets...</div>
                  ) : listErr ? (
                    <div className="tickets-error">{listErr}</div>
                  ) : !hasTickets ? (
                    <div className="tickets-empty">
                      <div className="tickets-empty__icon" aria-hidden="true">
                        <img src={ticketFrank} alt="" aria-hidden="true" />
                      </div>
                      <div className="tickets-empty__title">No Tickets Yet</div>
                      <div className="tickets-empty__sub">
                        You haven&apos;t created any tickets yet.
                      </div>

                      <button
                        className="btn btn-primary tickets-cta"
                        type="button"
                        onClick={openCreate}
                      >
                        Create Your First Ticket
                      </button>
                    </div>
                  ) : (
                    <div className="tickets-list">
                      <div className="tickets-list__top">
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={openCreate}
                        >
                          Create Ticket
                        </button>

                        {selectedTicket ? (
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {
                              setSelectedTicketId(null);
                              setThread([]);
                              setReply("");
                              setReplyErr("");
                              setThreadErr("");
                            }}
                          >
                            Close Conversation
                          </button>
                        ) : null}
                      </div>

                      <div className="tickets-table">
                        {tickets.map((t) => {
                          const isActive = selectedTicketId === t.id;
                          return (
                            <button
                              type="button"
                              className={`ticket-row ${isActive ? "is-active" : ""}`}
                              key={t.id}
                              onClick={() => openTicket(t.id)}
                            >
                              <div className="ticket-row__left">
                                <div className="ticket-type">{t.type}</div>
                                <div className="ticket-meta">
                                  #{t.id} •{" "}
                                  {new Date(t.createdAt).toLocaleString()}
                                </div>
                              </div>

                              <div
                                className={`ticket-status ticket-status--${String(
                                  t.status,
                                ).toLowerCase()}`}
                              >
                                {t.status}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* RIGHT: CONVERSATION OR TYPES */}
              <section className="panel tickets-panel">
                <div className="panel-head">
                  {selectedTicket
                    ? `TICKET #${selectedTicket.id}`
                    : "TICKET TYPES"}
                </div>

                <div className="panel-body tickets-body tickets-body--types">
                  {!selectedTicket ? (
                    <>
                      <img
                        className="support-duck"
                        src={duckImg}
                        alt=""
                        aria-hidden="true"
                      />

                      <ul className="ticket-types">
                        {TICKET_TYPES.map((tt) => (
                          <li key={tt}>• {tt}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="ticket-thread">
                      <div className="ticket-thread__meta">
                        <div className="ticket-thread__metaLeft">
                          <div className="ticket-thread__type">
                            {selectedTicket.type}
                          </div>
                          <div className="ticket-thread__status">
                            Status:{" "}
                            <span
                              className={`ticket-status ticket-status--${String(
                                selectedTicket.status,
                              ).toLowerCase()}`}
                            >
                              {selectedTicket.status}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => loadThread(selectedTicket.id)}
                          disabled={threadLoading}
                        >
                          {threadLoading ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>

                      <div className="ticket-thread__box">
                        {threadLoading ? (
                          <div className="muted">Loading conversation...</div>
                        ) : threadErr ? (
                          <div className="tickets-error">{threadErr}</div>
                        ) : (
                          <>
                            {/* Always show original ticket message at top */}
                            <div className="ticket-bubble ticket-bubble--user">
                              <div className="ticket-bubble__top">
                                <span className="ticket-bubble__name">You</span>
                                <span className="ticket-bubble__time">
                                  {new Date(
                                    selectedTicket.createdAt,
                                  ).toLocaleString()}
                                </span>
                              </div>
                              <div className="ticket-bubble__msg">
                                {selectedTicket.message}
                              </div>
                            </div>

                            {/* Then thread messages */}
                            {thread.map((m) => (
                              <div
                                key={`${m.id}-${m.createdAt}`}
                                className={`ticket-bubble ticket-bubble--${m.senderType}`}
                              >
                                <div className="ticket-bubble__top">
                                  <span className="ticket-bubble__name">
                                    {m.senderName}
                                  </span>
                                  <span className="ticket-bubble__time">
                                    {new Date(m.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="ticket-bubble__msg">
                                  {m.message}
                                </div>
                              </div>
                            ))}

                            <div ref={threadEndRef} />
                          </>
                        )}
                      </div>

                      <div className="ticket-thread__reply">
                        {replyErr ? (
                          <div className="tickets-error">{replyErr}</div>
                        ) : null}

                        <textarea
                          className="tickets-input tickets-textarea ticket-thread__textarea"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder={
                            selectedTicket.status === "Closed"
                              ? "This ticket is closed."
                              : "Write a reply to staff..."
                          }
                          maxLength={1000}
                          disabled={
                            isReplying || selectedTicket.status === "Closed"
                          }
                        />

                        <div className="ticket-thread__replyRow">
                          <div className="tickets-count">
                            {clamp(replyLen, 0, 1000)}/1000
                          </div>

                          <button
                            className={`btn btn-primary ${
                              canReply && !isReplying ? "" : "is-disabled"
                            }`}
                            type="button"
                            onClick={sendReply}
                            disabled={!canReply || isReplying}
                          >
                            {isReplying ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <>
              {/* WARNING BAR */}
              <div className="tickets-warning">
                <span className="tickets-warning__icon" aria-hidden="true">
                  <img src={infoImg} alt="" aria-hidden="true" />
                </span>
                <span>
                  Spamming tickets will result in a ban, please do not abuse
                  this system.
                </span>
              </div>

              <div className="tickets-grid">
                {/* LEFT: CREATE */}
                <section className="panel tickets-panel">
                  <div className="panel-head">CREATE A NEW TICKET</div>
                  <div className="panel-body tickets-body">
                    {err && <div className="tickets-error">{err}</div>}

                    <label className="tickets-label">Ticket Type</label>
                    <div className="tickets-selectWrap">
                      <select
                        className="tickets-input tickets-select"
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        disabled={isSubmitting}
                      >
                        <option value="">Select ticket type</option>
                        {TICKET_TYPES.map((tt) => (
                          <option key={tt} value={tt}>
                            {tt}
                          </option>
                        ))}
                      </select>
                      <span className="tickets-selectCaret" aria-hidden="true">
                        ▾
                      </span>
                    </div>

                    <label className="tickets-label" style={{ marginTop: 14 }}>
                      Message
                    </label>
                    <textarea
                      className="tickets-input tickets-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue in detail (minimum 50 characters)"
                      maxLength={1000}
                      disabled={isSubmitting}
                    />

                    <div className="tickets-count">
                      {clamp(messageLen, 0, 1000)}/1000 characters (minimum 50)
                    </div>

                    <button
                      className={`btn btn-primary tickets-submit ${
                        canSubmit && !isSubmitting ? "" : "is-disabled"
                      }`}
                      type="button"
                      onClick={submitTicket}
                      disabled={!canSubmit || isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Ticket"}
                    </button>

                    <button
                      className="btn btn-secondary tickets-back"
                      type="button"
                      onClick={goBackToList}
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                  </div>
                </section>

                {/* RIGHT: GUIDELINES */}
                <section className="panel tickets-panel">
                  <div className="panel-head">TICKET GUIDELINES</div>
                  <div className="panel-body tickets-body">
                    <ul className="ticket-guidelines">
                      {GUIDELINES.map((g) => (
                        <li key={g}>• {g}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";
import { useToast } from "../../ui/toast/ToastContext";

type ChatScope = "room" | "private";

type ChatLogItem = {
  id: number | null;
  roomId: number | null;
  userFromId: number;
  userToId: number | null;
  fromUsername: string;
  toUsername: string | null;
  message: string;
  timestamp: number;
};

type ChatLogsResponse = {
  ok: boolean;
  scope: ChatScope;
  total: number;
  page: number;
  limit: number;
  pages: number;
  items: ChatLogItem[];
  error?: string;
};

function formatTimestamp(unix: number) {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function HKChatLogs() {
  const { showToast } = useToast();
  const [scope, setScope] = useState<ChatScope>("room");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ChatLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  async function load() {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams({
        scope,
        page: String(page),
        limit: String(limit),
      });

      if (search.trim()) qs.set("search", search.trim());

      const res = await hkRequest<ChatLogsResponse>(
        `/hk/chatlogs?${qs.toString()}`,
      );

      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(Number(res.total || 0));
    } catch (e: any) {
      const msg = e?.message || "Failed to load chat logs.";
      setError(msg);
      setItems([]);
      setTotal(0);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, page, search]);

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function onSwitchScope(nextScope: ChatScope) {
    setScope(nextScope);
    setPage(1);
  }

  return (
    <div className="panel hk-chatlogs">
      <div className="panel-head">
        <div className="panel-title">Chat Logs</div>
      </div>

      <div className="panel-body">
        <div className="hk-chatlogs__toolbar">
          <div className="hk-chatlogs__scopeTabs">
            <button
              type="button"
              className={`hk-ticketFilterBtn ${scope === "room" ? "active" : ""}`}
              onClick={() => onSwitchScope("room")}
            >
              Room Chat
            </button>
            <button
              type="button"
              className={`hk-ticketFilterBtn ${scope === "private" ? "active" : ""}`}
              onClick={() => onSwitchScope("private")}
            >
              Private / Whispers
            </button>
          </div>

          <form className="hk-chatlogs__search" onSubmit={onSearchSubmit}>
            <input
              className="hk-tickets__searchInput"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search message text, username, or user ID"
            />
            <button type="submit" className="hk-tickets__searchBtn">
              Search
            </button>
          </form>
        </div>

        <div className="hk-chatlogs__metaRow">
          <div className="hk-tickets__meta">
            {loading
              ? "Loading chat logs..."
              : `${total} ${scope === "private" ? "whispers" : "room messages"} found`}
          </div>
          {search && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              Clear Search
            </button>
          )}
        </div>

        {error && <div className="hk-alert--error">{error}</div>}

        <div className="hk-ticketsTableWrap hk-chatlogsTableWrap">
          <div className="hk-chatlogsTable">
            <div className="hk-chatlogsRow hk-chatlogsRow--head">
              <div>Time</div>
              <div>From</div>
              <div>To / Room</div>
              <div>Message</div>
            </div>

            {!loading && items.length === 0 && (
              <div className="hk-table__empty">No chat logs matched your search.</div>
            )}

            {items.map((item, index) => (
              <div
                className="hk-chatlogsRow"
                key={`${item.id ?? item.timestamp}-${item.userFromId}-${index}`}
              >
                <div className="hk-chatlogsCell hk-chatlogsCell--time">
                  {formatTimestamp(item.timestamp)}
                </div>

                <div className="hk-chatlogsCell">
                  <div className="hk-chatlogsUser">{item.fromUsername}</div>
                  <div className="hk-chatlogsSub">ID: {item.userFromId}</div>
                </div>

                <div className="hk-chatlogsCell">
                  {scope === "private" ? (
                    item.toUsername ? (
                      <>
                        <div className="hk-chatlogsUser">{item.toUsername}</div>
                        <div className="hk-chatlogsSub">ID: {item.userToId}</div>
                      </>
                    ) : (
                      <span className="hk-muted">—</span>
                    )
                  ) : item.roomId ? (
                    <>
                      <div className="hk-chatlogsUser">Room #{item.roomId}</div>
                      <div className="hk-chatlogsSub">Public room chat</div>
                    </>
                  ) : (
                    <span className="hk-muted">—</span>
                  )}
                </div>

                <div className="hk-chatlogsCell hk-chatlogsCell--message">
                  {item.message || <span className="hk-muted">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hk-newsPager hk-chatlogsPager">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Prev
          </button>

          <div className="hk-muted">
            Page {page} / {pageCount}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

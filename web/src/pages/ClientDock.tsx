import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type DockState = {
  fullscreen: boolean; // fullscreen overlay vs docked bottom-right
  open: boolean; // whether client window is visible at all
};

const DOCK_KEY = "plus_client_dock_v3";

function loadDock(): DockState {
  try {
    const raw = localStorage.getItem(DOCK_KEY);
    if (!raw) throw new Error("no");
    const parsed = JSON.parse(raw);

    return {
      fullscreen: Boolean(parsed.fullscreen),
      open: parsed.open === undefined ? false : Boolean(parsed.open),
    };
  } catch {
    // default: closed until user opens it
    return { fullscreen: false, open: false };
  }
}

function saveDock(s: DockState) {
  localStorage.setItem(DOCK_KEY, JSON.stringify(s));
}

type ClientDockApi = {
  openDock: () => void;
  openFullscreen: () => void;
  refresh: () => void; // refreshes the Nitro client (regenerates SSO + reloads iframe)
  close: () => void;
};

const Ctx = createContext<ClientDockApi | null>(null);

export function useClientDock() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useClientDock must be used within <ClientDockProvider />");
  }
  return ctx;
}

export default function ClientDockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  const [dock, setDock] = useState<DockState>(() => loadDock());
  const [ticket, setTicket] = useState("");
  const [nitroBase, setNitroBase] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Used to force an iframe reload and trigger ticket refresh
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => saveDock(dock), [dock]);

  const fetchClientBootInfo = useCallback(async () => {
    setErr(null);

    if (loading) return;
    if (!user) return;
    if (!dock.open) return;

    // load base URL once
    if (!nitroBase) {
      const cfg = await api.clientConfig();
      const base = String(cfg?.nitroUrl || "").trim();
      if (!base) throw new Error("Nitro URL is missing from clientConfig().");
      setNitroBase(base);
    }

    // always get a fresh SSO ticket when (re)loading
    const sso = await api.sso();
    const t = String(sso?.ticket || "").trim();
    if (!t) throw new Error("Failed to generate SSO ticket.");
    setTicket(t);
  }, [dock.open, loading, user, nitroBase]);

  // Load config + SSO when opened, and whenever refresh is requested
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!dock.open) return;

        await fetchClientBootInfo();
        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to launch client.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [dock.open, reloadKey, fetchClientBootInfo]);

  const iframeSrc = useMemo(() => {
    if (!ticket || !nitroBase) return "";

    const base = nitroBase.trim().replace(/\/$/, "");
    const indexUrl = base.toLowerCase().endsWith(".html")
      ? base
      : `${base}/index.html`;

    const joiner = indexUrl.includes("?") ? "&" : "?";
    // include a cache-buster too
    return `${indexUrl}${joiner}sso=${encodeURIComponent(ticket)}&r=${reloadKey}`;
  }, [ticket, nitroBase, reloadKey]);

  const canShowClient = Boolean(iframeSrc);

  const openDock = useCallback(() => {
    setDock({ open: true, fullscreen: false });
  }, []);

  const openFullscreen = useCallback(() => {
    setDock({ open: true, fullscreen: true });
  }, []);

  const close = useCallback(() => {
    setDock({ open: false, fullscreen: false });
  }, []);

  const refresh = useCallback(() => {
    // force new SSO + remount iframe
    setErr(null);
    setTicket("");
    setReloadKey((k) => k + 1);
  }, []);

  const apiValue: ClientDockApi = useMemo(
    () => ({
      openDock,
      openFullscreen,
      refresh,
      close,
    }),
    [openDock, openFullscreen, refresh, close],
  );

  const toggleFullscreen = () =>
    setDock((p) => ({ ...p, fullscreen: !p.fullscreen, open: true }));

  const dockToCorner = () =>
    setDock((p) => ({ ...p, fullscreen: false, open: true }));

  const showWindow = dock.open;

  const clientNode = showWindow ? (
    <div className={`client-shell ${dock.fullscreen ? "is-full" : "is-dock"}`}>
      {/* Buttons pinned TOP RIGHT */}
      <div className="client-controls">
        {dock.fullscreen ? (
          <button
            className="icon-btn"
            onClick={dockToCorner}
            title="Dock bottom-right"
            type="button"
          >
            ⧉
          </button>
        ) : (
          <button
            className="icon-btn"
            onClick={toggleFullscreen}
            title="Maximize"
            type="button"
          >
            ⤢
          </button>
        )}

        {/* REFRESH (replaces minimize) */}
        <button
          className="icon-btn"
          onClick={refresh}
          title="Refresh Client"
          type="button"
        >
          ↻
        </button>

        <button
          className="icon-btn"
          onClick={close}
          title="Close"
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="client-body no-header">
        {!canShowClient ? (
          <div className="panel" style={{ width: "100%" }}>
            <div className="panel-body">
              {err && <div className="form-alert form-alert--error">{err}</div>}
              <div className="muted">Generating SSO and loading Nitro...</div>
            </div>
          </div>
        ) : (
          <iframe
            key={reloadKey} // ensures a true refresh/remount
            id="nitro"
            src={iframeSrc}
            title="Nitro Client"
            className="client-iframe"
            allow="clipboard-read; clipboard-write"
            allowFullScreen
          />
        )}
      </div>
    </div>
  ) : null;

  return (
    <Ctx.Provider value={apiValue}>
      {children}

      {/* PORTAL: render to document.body so layout transforms can't affect fixed positioning */}
      {typeof document !== "undefined" &&
        createPortal(clientNode, document.body)}
    </Ctx.Provider>
  );
}

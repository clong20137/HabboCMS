import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type DockState = {
  fullscreen: boolean;
  open: boolean;
};

const DOCK_KEY = "plus_client_dock_v3";

function loadDock(): DockState {
  try {
    const raw = localStorage.getItem(DOCK_KEY);
    if (!raw) throw new Error("no");

    const parsed = JSON.parse(raw);

    return {
      fullscreen: Boolean(parsed.fullscreen),
      open: false,
    };
  } catch {
    return { fullscreen: false, open: false };
  }
}

function saveDock(s: DockState) {
  localStorage.setItem(DOCK_KEY, JSON.stringify(s));
}

type ClientDockApi = {
  openDock: () => void;
  openFullscreen: () => void;
  refresh: () => void;
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
  const [reloadKey, setReloadKey] = useState(0);

  const launchedRef = useRef(false);

  useEffect(() => {
    saveDock(dock);
  }, [dock]);

  useEffect(() => {
    if (loading || user) return;

    launchedRef.current = false;
    setErr(null);
    setTicket("");
    setDock({ open: false, fullscreen: false });
  }, [loading, user]);

  useEffect(() => {
    let alive = true;

    if (!dock.open) return;
    if (loading || !user) return;
    if (launchedRef.current && reloadKey === 0) return;

    (async () => {
      try {
        setErr(null);

        let base = nitroBase;

        if (!base) {
          const cfg = await api.clientConfig();
          base = String(cfg?.nitroUrl || "").trim();

          if (!base) {
            throw new Error("Nitro URL is missing from clientConfig().");
          }

          if (!alive) return;
          setNitroBase(base);
        }

        const sso = await api.sso();
        const t = String(sso?.ticket || "").trim();

        if (!t) {
          throw new Error("Failed to generate SSO ticket.");
        }

        if (!alive) return;

        setTicket(t);
        launchedRef.current = true;
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to launch client.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [dock.open, reloadKey, loading, user, nitroBase]);

  const iframeSrc = useMemo(() => {
    if (!ticket || !nitroBase) return "";

    const base = nitroBase.trim().replace(/\/$/, "");
    const indexUrl = base.toLowerCase().endsWith(".html")
      ? base
      : `${base}/index.html`;

    const joiner = indexUrl.includes("?") ? "&" : "?";

    return `${indexUrl}${joiner}sso=${encodeURIComponent(ticket)}&r=${reloadKey}`;
  }, [ticket, nitroBase, reloadKey]);

  const canShowClient = Boolean(iframeSrc);

  const openDock = useCallback(() => {
    setErr(null);
    setDock({ open: true, fullscreen: false });
  }, []);

  const openFullscreen = useCallback(() => {
    setErr(null);
    setDock({ open: true, fullscreen: true });
  }, []);

  const close = useCallback(() => {
    launchedRef.current = false;
    setErr(null);
    setTicket("");
    setDock({ open: false, fullscreen: false });
  }, []);

  const refresh = useCallback(() => {
    launchedRef.current = false;
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

  const toggleFullscreen = () => {
    setDock((p) => ({ ...p, fullscreen: !p.fullscreen, open: true }));
  };

  const dockToCorner = () => {
    setDock((p) => ({ ...p, fullscreen: false, open: true }));
  };

  const showWindow = dock.open;

  const clientNode = showWindow ? (
    <div className={`client-shell ${dock.fullscreen ? "is-full" : "is-dock"}`}>
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
            key={reloadKey}
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
      {typeof document !== "undefined" &&
        createPortal(clientNode, document.body)}
    </Ctx.Provider>
  );
}

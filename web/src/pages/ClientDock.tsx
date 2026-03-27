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
  const shellRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const lockScroll = dock.open && dock.fullscreen;

    body.classList.toggle("client-open-fullscreen", lockScroll);
    html.classList.toggle("client-open-fullscreen", lockScroll);

    return () => {
      body.classList.remove("client-open-fullscreen");
      html.classList.remove("client-open-fullscreen");
    };
  }, [dock.open, dock.fullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;

      if (!isFs && dock.open && dock.fullscreen) {
        setDock((prev) => ({ ...prev, fullscreen: false }));
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [dock.open, dock.fullscreen]);

  const requestTrueFullscreen = useCallback(async () => {
    const el = shellRef.current as any;
    if (!el) return;

    try {
      if (document.fullscreenElement) return;

      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
        return;
      }

      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }

      if (el.webkitEnterFullscreen) {
        el.webkitEnterFullscreen();
      }
    } catch {}
  }, []);

  const exitTrueFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }

      const doc = document as any;

      if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } catch {}
  }, []);

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

  const openFullscreen = useCallback(async () => {
    setErr(null);
    setDock({ open: true, fullscreen: true });

    requestAnimationFrame(() => {
      requestTrueFullscreen();
    });
  }, [requestTrueFullscreen]);

  const close = useCallback(() => {
    launchedRef.current = false;
    setErr(null);
    setTicket("");
    setDock({ open: false, fullscreen: false });
    exitTrueFullscreen();
  }, [exitTrueFullscreen]);

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

  const toggleFullscreen = async () => {
    if (dock.fullscreen) {
      setDock((p) => ({ ...p, fullscreen: false, open: true }));
      await exitTrueFullscreen();
    } else {
      setDock((p) => ({ ...p, fullscreen: true, open: true }));
      requestAnimationFrame(() => {
        requestTrueFullscreen();
      });
    }
  };

  const dockToCorner = async () => {
    setDock((p) => ({ ...p, fullscreen: false, open: true }));
    await exitTrueFullscreen();
  };

  const showWindow = dock.open;

  const clientNode = showWindow ? (
    <div
      ref={shellRef}
      className={`client-shell ${dock.fullscreen ? "is-full" : "is-dock"}`}
    >
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
        {err ? (
          <div className="client-error">
            <div className="form-alert form-alert--error">{err}</div>
          </div>
        ) : canShowClient ? (
          <iframe
            key={reloadKey}
            id="nitro"
            src={iframeSrc}
            title="Nitro Client"
            className="client-iframe"
            allow="clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="client-loading-mask" aria-hidden="true" />
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

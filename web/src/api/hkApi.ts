const API_BASE = "/api";
const CSRF_URL = `${API_BASE}/auth/csrf`;

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

function isMutation(method: string) {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    const r = await fetch(CSRF_URL, { method: "GET", credentials: "include" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.csrfToken)
      throw new Error(data?.error || "CSRF init failed");
    csrfToken = String(data.csrfToken);
    return csrfToken;
  })();

  try {
    return await csrfPromise;
  } finally {
    csrfPromise = null;
  }
}

export async function hkRequest<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const method = String(opts.method || "GET").toUpperCase();

  const headers: Record<string, string> = {
    ...(opts.headers ? (opts.headers as any) : {}),
  };

  if (isMutation(method)) {
    const token = await ensureCsrf();
    headers["X-CSRF-Token"] = token;
    if (opts.body && !headers["Content-Type"])
      headers["Content-Type"] = "application/json";
  }

  let r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    method,
    credentials: "include",
    headers,
  });

  let data = await r.json().catch(() => ({}));

  if (
    isMutation(method) &&
    r.status === 403 &&
    String(data?.error || data?.message || "").toLowerCase().includes("csrf")
  ) {
    csrfToken = null;
    const token = await ensureCsrf();
    r = await fetch(`${API_BASE}${path}`, {
      ...opts,
      method,
      credentials: "include",
      headers: {
        ...headers,
        "X-CSRF-Token": token,
      },
    });
    data = await r.json().catch(() => ({}));
  }

  if (!r.ok)
    throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data as T;
}

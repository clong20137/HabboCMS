
const API_BASE = "/api";

let csrfToken: string | null = null;

async function ensureCsrf() {
  if (csrfToken) return csrfToken;

  const res = await fetch(API_BASE + "/auth/csrf", {
    credentials: "include"
  });

  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function hkFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const method = (opts.method || "GET").toUpperCase();
  const isMutation = !["GET","HEAD","OPTIONS"].includes(method);

  const headers: any = {
    ...(opts.body ? { "Content-Type":"application/json" } : {}),
    ...(opts.headers || {})
  };

  if (isMutation) {
    const token = await ensureCsrf();
    headers["X-CSRF-Token"] = token;
  }

  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

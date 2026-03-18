const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const DEFAULT_TIMEOUT_MS = 15_000;

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

function isMutation(method?: string) {
  const m = String(method || "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    const res = await fetch(`${API_BASE}/auth/csrf`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.csrfToken) {
      throw new Error(data?.error || "Failed to initialize CSRF.");
    }

    csrfToken = String(data.csrfToken);
    return csrfToken;
  })();

  try {
    return await csrfPromise;
  } finally {
    csrfPromise = null;
  }
}

function mergeAbortSignals(
  a?: AbortSignal,
  b?: AbortSignal,
): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (a.aborted || b.aborted) c.abort();
  else {
    a.addEventListener("abort", onAbort, { once: true });
    b.addEventListener("abort", onAbort, { once: true });
  }
  return c.signal;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const signal = mergeAbortSignals(
      init.signal ?? undefined,
      controller.signal,
    );
    return await fetch(input, { ...init, signal });
  } finally {
    window.clearTimeout(t);
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();

  let csrfHeader: Record<string, string> = {};
  if (isMutation(method)) {
    const token = await ensureCsrfToken();
    csrfHeader = { "X-CSRF-Token": token };
  }

  const extraHeaders =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : (options.headers as Record<string, string> | undefined) || {};

  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...options,
    method,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...csrfHeader,
      ...extraHeaders,
    },
  });

  const text = await res.text();

  if (text.includes("<!DOCTYPE") || text.includes("<html")) {
    throw new Error("Endpoint not configured (missing API route).");
  }

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Request failed" };
  }

  // CSRF auto-retry
  if (
    res.status === 403 &&
    isMutation(method) &&
    String(data?.error || "")
      .toLowerCase()
      .includes("csrf")
  ) {
    csrfToken = null;
    const token = await ensureCsrfToken();

    const retry = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...options,
      method,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        "X-CSRF-Token": token,
        ...extraHeaders,
      },
    });

    const retryText = await retry.text();
    let retryData: any = {};
    try {
      retryData = retryText ? JSON.parse(retryText) : {};
    } catch {
      retryData = { error: retryText || "Request failed" };
    }

    if (!retry.ok) {
      if (retry.status === 403 && retryData?.error === "BANNED") {
        window.dispatchEvent(
          new CustomEvent("auth:banned", {
            detail: {
              reason: retryData?.reason,
              expiresAt: retryData?.expiresAt,
            },
          }),
        );
      }
      throw new Error(retryData?.error || `HTTP ${retry.status}`);
    }

    return retryData as T;
  }

  if (!res.ok) {
    if (res.status === 403 && data?.error === "BANNED") {
      window.dispatchEvent(
        new CustomEvent("auth:banned", {
          detail: { reason: data?.reason, expiresAt: data?.expiresAt },
        }),
      );
    }
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data as T;
}

async function postJson<T = any>(path: string, body: any): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* =========================
2FA (ACCOUNT SETTINGS)
========================= */

export async function get2FAStatus() {
  const data = await request<{ ok: boolean; enabled: boolean }>(`/2fa/status`, {
    method: "GET",
  });
  if (!data?.ok) throw new Error("Failed to load 2FA status.");
  return data;
}

export async function start2FASetup() {
  const data = await postJson<{
    ok: boolean;
    qrDataUrl: string;
    backupCodes: string[];
  }>(`/2fa/setup`, {});
  if (!data?.ok) throw new Error("Failed to start 2FA setup.");
  return data;
}

export async function enable2FA(code: string) {
  const data = await postJson<{ ok: boolean; enabled: boolean }>(
    `/2fa/enable`,
    {
      code,
    },
  );
  if (!data?.ok) throw new Error("Failed to enable 2FA.");
  return data;
}

export async function disable2FA() {
  const data = await postJson<{ ok: boolean; enabled: boolean }>(
    `/2fa/disable`,
    {},
  );
  if (!data?.ok) throw new Error("Failed to disable 2FA.");
  return data;
}

/* =========================
AUTH
========================= */

export async function checkUsername(username: string) {
  const u = username.trim();

  const data = await request<{ ok: true; available: boolean }>(
    `/auth/check-username?username=${encodeURIComponent(u)}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to check username.");
  return data.available;
}

export async function getRegisterConfig() {
  const data = await request<{ ok: true; betaRequired: boolean }>(
    `/auth/register-config`,
    { method: "GET" },
  );
  if (!data?.ok) throw new Error("Failed to load register config.");
  return data;
}

export async function getSiteConfig() {
  const data = await request<{ ok: true; hotelName: string }>(`/site-config`, {
    method: "GET",
  });
  if (!data?.ok) throw new Error("Failed to load site config.");
  return data;
}

/* =========================
LEADERBOARDS
========================= */

export type LeaderboardStat =
  | "credits"
  | "bank_credits"
  | "kills"
  | "deaths"
  | "punches_thrown"
  | "punches_landed"
  | "arrests"
  | "robberies"
  | "damage_inflicted"
  | "damage_received"
  | "xp"
  | "arena_wins"
  | "arena_losses"
  | "strength"
  | "defense"
  | "stamina"
  | "gathering"
  | "knowledge";

export type LeaderboardItem = {
  id: number;
  username: string;
  value: number;
};

export async function getLeaderboard(stat: LeaderboardStat, limit = 10) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 50)
    : 10;

  const data = await request<{
    ok: true;
    field: string;
    items: LeaderboardItem[];
  }>(
    `/leaderboards/${encodeURIComponent(stat)}?limit=${encodeURIComponent(safeLimit)}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to load leaderboard.");
  return data.items;
}

export type CreditsLeaderboardItem = {
  id: number;
  username: string;
  credits: number;
};

export async function getCreditsLeaderboard(limit = 10) {
  const items = await getLeaderboard("credits", limit);
  return items.map((x) => ({
    id: x.id,
    username: x.username,
    credits: Number(x.value || 0),
  })) as CreditsLeaderboardItem[];
}

/* =========================
NEWS
========================= */

export type NewsItem = {
  id: number;
  title: string;
  description: string;
  author: string;
  image: string;
  imageUrl: string;
  createdAt: string;
};

export type NewsDetail = NewsItem & {
  story: string;
};

export type NewsStory = NewsDetail;

export type NewsComment = {
  id: number;
  newsId: number;
  userId: number;
  username: string;
  body: string;
  createdAt: string;
  reactions: Record<string, number>;
  myReactions: string[];
};

export type NewsCommentsResponse = {
  items: NewsComment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getNewsComments(newsId: number, page = 1, limit = 10) {
  const safePage = Number.isFinite(page) ? Math.max(1, page) : 1;
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 50)
    : 10;

  const data = await request<{
    ok: true;
    items: NewsComment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(
    `/news/${encodeURIComponent(newsId)}/comments?page=${encodeURIComponent(
      safePage,
    )}&limit=${encodeURIComponent(safeLimit)}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to load comments");

  return {
    items: Array.isArray(data.items) ? data.items : [],
    pagination: {
      page: Number(data.pagination?.page ?? safePage),
      limit: Number(data.pagination?.limit ?? safeLimit),
      total: Number(data.pagination?.total ?? 0),
      totalPages: Number(data.pagination?.totalPages ?? 1),
    },
  } as NewsCommentsResponse;
}

export async function postNewsComment(newsId: number, body: string) {
  const data = await postJson<{ ok: true; item: NewsComment }>(
    `/news/${encodeURIComponent(newsId)}/comments`,
    { body },
  );

  if (!data?.ok) throw new Error("Failed to post comment");
  return data.item;
}

export async function toggleCommentReaction(
  commentId: number,
  reaction: string,
) {
  return request<{
    ok: true;
    reactions: Record<string, number>;
    myReactions: string[];
  }>(`/news/comments/${commentId}/reactions/toggle`, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

export async function getNews(limit = 3) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 20)
    : 3;

  const data = await request<{ ok: true; items: NewsItem[] }>(
    `/news?limit=${encodeURIComponent(safeLimit)}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to load news");
  return data.items;
}

export async function getNewsById(id: number) {
  const data = await request<{ ok: true; item: NewsDetail }>(
    `/news/${encodeURIComponent(id)}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to load news");
  return data.item;
}

export async function getRecentNews(currentId: number, limit = 6) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 12)
    : 6;

  const data = await request<{ ok: true; items: NewsItem[] }>(
    `/news/${encodeURIComponent(currentId)}/recent?limit=${encodeURIComponent(
      safeLimit,
    )}`,
    { method: "GET" },
  );

  if (!data?.ok) throw new Error("Failed to load recent news");
  return data.items;
}

/* =========================
TICKETS
========================= */

export type TicketType =
  | "Ban Appeal"
  | "Scam Report"
  | "VPN/Proxy Whitelist Request"
  | "Password Recovery"
  | "Store Payment Issue"
  | "Other";

export type TicketStatus = "Open" | "Pending" | "Closed";

export type TicketItem = {
  id: number;
  type: TicketType;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
};

export async function getMyTickets(limit = 100) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 100)
    : 100;

  const data = await request<{ ok: true; items: TicketItem[] }>(
    `/tickets/my?limit=${encodeURIComponent(safeLimit)}`,
    { method: "GET" },
  );
  if (!data?.ok) throw new Error("Failed to load tickets.");
  return data.items;
}

export async function createTicket(type: TicketType, message: string) {
  const data = await postJson<{ ok: true; item: TicketItem }>(`/tickets`, {
    type,
    message,
  });
  if (!data?.ok) throw new Error("Failed to create ticket.");
  return data.item;
}

export async function getTicketTypes() {
  const data = await request<{ ok: true; items: TicketType[] }>(
    `/tickets/types`,
    {
      method: "GET",
    },
  );

  if (!data?.ok) throw new Error("Failed to load ticket types.");
  return data.items;
}

/* =========================
LOGIN + 2FA CHALLENGE FLOW
========================= */

// Login can return either success OR "2FA required" (no throw)
export type LoginResponse =
  | { ok: true }
  | { ok: true; twoFaRequired: true; challengeId: string };

// NOTE: this returns the body so Login.tsx can check twoFaRequired
export async function login(
  username: string,
  password: string,
  captchaToken: string,
) {
  const res = await postJson<LoginResponse>("/auth/login", {
    username,
    password,
    captchaToken,
  });
  return res;
}

// After login says 2FA required, call this to finish login (server sets auth cookie)
export async function verifyLogin2FA(challengeId: string, code: string) {
  const res = await postJson<{ ok: true }>(`/auth/2fa/verify-login`, {
    challengeId,
    code,
  });
  return res;
}

/* =========================
STATS SETUP (POST-REGISTER)
Uses /api/auth/stats-setup/*
========================= */

export type StatsSetupStatus = {
  ok: true;
  statsSetupDone: boolean;
  points: number;

  strength: number;
  knowledge: number;
  farming: number;
  health: number;
  defense: number;
  stamina: number;

  maxHealth: number;
  maxEnergy: number;
};

export async function getStatsSetupStatus() {
  const data = await request<StatsSetupStatus>(`/auth/stats-setup/status`, {
    method: "GET",
  });

  if (!data?.ok) throw new Error("Failed to load points.");
  return data;
}

export async function applyStatsSetup(payload: {
  strength: number;
  knowledge: number;
  farming: number;
  health: number;
  defense: number;
  stamina: number;
}) {
  const data = await postJson<{
    ok: true;
    spent?: number;
    alreadyDone?: boolean;
  }>(`/auth/stats-setup/apply`, payload);

  if (!data?.ok) throw new Error("Failed to save points.");
  return data;
}

/* =========================
LOGIN HISTORY ✅
========================= */

export async function getLoginHistory(
  limit = 20,
): Promise<{ ok: true; rows: any[] }> {
  return request(
    `/auth/login-history?limit=${encodeURIComponent(String(limit))}`,
    {
      method: "GET",
    },
  );
}

/* =========================
API OBJECT
========================= */

export const api = {
  // Auth
  login, // supports 2FA challenge
  verifyLogin2FA,

  register: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string,
    betaCode?: string,
    captchaToken?: string | null,
  ) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        email,
        password,
        confirmPassword,
        betaCode,
        captchaToken,
      }),
    }),

  getRegisterConfig,

  logout: () => request("/auth/logout", { method: "POST" }),

  me: () => request("/auth/me", { method: "GET" }),

  sso: () => request("/auth/sso", { method: "POST" }),

  // Client / misc
  clientConfig: () => request("/client/config", { method: "GET" }),

  onlineCount: () => request("/online-count", { method: "GET" }),

  getStaff: () =>
    request<{ ok: true; staff: any[] }>("/staff", { method: "GET" }),

  changePassword(
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    return postJson("/auth/password", {
      oldPassword,
      newPassword,
      confirmPassword,
    });
  },

  /* 2FA (account settings) */
  get2FAStatus,
  start2FASetup,
  enable2FA,
  disable2FA,

  /* ✅ Login history */
  getLoginHistory,

  // leaderboards
  getLeaderboard,
  getCreditsLeaderboard,

  // news
  getNews,
  getNewsById,
  getRecentNews,
  getNewsComments,
  postNewsComment,
  toggleCommentReaction,

  // tickets
  getMyTickets,
  createTicket,
  getTicketTypes,

  // misc
  getSiteConfig,
  checkUsername,

  // character points
  getStatsSetupStatus,
  applyStatsSetup,
};

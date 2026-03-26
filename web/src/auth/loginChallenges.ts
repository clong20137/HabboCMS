import crypto from "crypto";

type Challenge = {
  id: string;
  userId: number;
  username: string;
  rank: number;
  secretEnc: string;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, Challenge>();

function cleanup() {
  const now = Date.now();
  for (const [id, c] of store.entries()) {
    if (c.expiresAt <= now) store.delete(id);
  }
}

export function createLoginChallenge(
  input: Omit<Challenge, "id" | "expiresAt">,
) {
  cleanup();

  const id = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + TTL_MS;

  const c: Challenge = { id, expiresAt, ...input };
  store.set(id, c);

  return { challengeId: id, expiresAt };
}

export function consumeLoginChallenge(challengeId: string) {
  cleanup();

  const c = store.get(challengeId);
  if (!c) return null;

  if (c.expiresAt <= Date.now()) {
    store.delete(challengeId);
    return null;
  }

  // consume (one-time)
  store.delete(challengeId);
  return c;
}

export function peekLoginChallenge(challengeId: string) {
  cleanup();
  const c = store.get(challengeId);
  if (!c) return null;
  if (c.expiresAt <= Date.now()) {
    store.delete(challengeId);
    return null;
  }
  return c;
}

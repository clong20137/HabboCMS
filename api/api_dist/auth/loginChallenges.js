"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoginChallenge = createLoginChallenge;
exports.consumeLoginChallenge = consumeLoginChallenge;
exports.peekLoginChallenge = peekLoginChallenge;
const crypto_1 = __importDefault(require("crypto"));
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map();
function cleanup() {
    const now = Date.now();
    for (const [id, c] of store.entries()) {
        if (c.expiresAt <= now)
            store.delete(id);
    }
}
function createLoginChallenge(input) {
    cleanup();
    const id = crypto_1.default.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + TTL_MS;
    const c = { id, expiresAt, ...input };
    store.set(id, c);
    return { challengeId: id, expiresAt };
}
function consumeLoginChallenge(challengeId) {
    cleanup();
    const c = store.get(challengeId);
    if (!c)
        return null;
    if (c.expiresAt <= Date.now()) {
        store.delete(challengeId);
        return null;
    }
    // consume (one-time)
    store.delete(challengeId);
    return c;
}
function peekLoginChallenge(challengeId) {
    cleanup();
    const c = store.get(challengeId);
    if (!c)
        return null;
    if (c.expiresAt <= Date.now()) {
        store.delete(challengeId);
        return null;
    }
    return c;
}

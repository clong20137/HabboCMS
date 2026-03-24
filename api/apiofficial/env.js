"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TURNSTILE_SECRET = exports.TWOFA_ENC_KEY = exports.DB_CONNECTION_LIMIT = exports.DB_NAME = exports.DB_PASS = exports.DB_USER = exports.DB_PORT = exports.DB_HOST = exports.TRUST_PROXY = exports.USE_HOST_COOKIE_PREFIX = exports.CORS_ORIGINS = exports.CORS_ORIGIN_RAW = exports.JWT_SECRET = exports.AUTH_COOKIE_NAME = exports.IS_PROD = exports.NODE_ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env from:
// 1) ENV_FILE (explicit), else
// 2) .env in current working directory.
dotenv_1.default.config({
    path: process.env.ENV_FILE
        ? path_1.default.resolve(process.env.ENV_FILE)
        : path_1.default.resolve(process.cwd(), ".env"),
});
exports.NODE_ENV = process.env.NODE_ENV ?? "development";
exports.IS_PROD = exports.NODE_ENV === "production";
exports.AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "pluscms_token";
exports.JWT_SECRET = (() => {
    const v = process.env.JWT_SECRET;
    if (!v)
        throw new Error("Missing required env: JWT_SECRET");
    return v;
})();
/**
* Comma-separated list of allowed origins, e.g.
* CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"
*/
exports.CORS_ORIGIN_RAW = String(process.env.CORS_ORIGIN || "").trim();
exports.CORS_ORIGINS = exports.CORS_ORIGIN_RAW
    ? exports.CORS_ORIGIN_RAW.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
// In production we REQUIRE a CORS allowlist (cookie auth needs this)
if (exports.IS_PROD && exports.CORS_ORIGINS.length === 0) {
    throw new Error("Missing required env in production: CORS_ORIGIN");
}
/**
* Optional: if you want __Host- cookies in prod you must:
* - serve over HTTPS
* - NOT set Domain
* - Path must be "/"
* and cookie must be Secure
*
* IMPORTANT:
* - __Host- cookies REQUIRE Secure, so they will NOT work on http://localhost
* - Force this to only ever be enabled in production
*/
exports.USE_HOST_COOKIE_PREFIX = exports.IS_PROD &&
    String(process.env.USE_HOST_COOKIE_PREFIX || "false").toLowerCase() === "true";
// Express trust proxy setting (important for req.ip / secure cookies behind TLS terminators)
exports.TRUST_PROXY = (() => {
    const raw = String(process.env.TRUST_PROXY ?? "1").trim();
    // If it's a number-like string, return number.
    const n = Number(raw);
    if (Number.isFinite(n))
        return n;
    // Otherwise allow Express' string options (e.g., "loopback")
    return raw;
})();
// Database
exports.DB_HOST = process.env.DB_HOST || "127.0.0.1";
exports.DB_PORT = Number(process.env.DB_PORT || 3306);
exports.DB_USER = process.env.DB_USER || "root";
exports.DB_PASS = process.env.DB_PASS || "";
exports.DB_NAME = process.env.DB_NAME || "plus";
exports.DB_CONNECTION_LIMIT = Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 10));
// 2FA + Turnstile
exports.TWOFA_ENC_KEY = process.env.TWOFA_ENC_KEY || "";
exports.TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";
if (exports.IS_PROD) {
    if (!exports.TWOFA_ENC_KEY || exports.TWOFA_ENC_KEY.length < 32) {
        throw new Error("Missing/weak env in production: TWOFA_ENC_KEY (32+ chars)");
    }
    if (!exports.TURNSTILE_SECRET) {
        throw new Error("Missing required env in production: TURNSTILE_SECRET");
    }
}

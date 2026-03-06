import dotenv from "dotenv";
import path from "path";

// Load env from:
// 1) ENV_FILE (explicit), else
// 2) .env in current working directory.
dotenv.config({
  path: process.env.ENV_FILE
    ? path.resolve(process.env.ENV_FILE)
    : path.resolve(process.cwd(), ".env"),
});

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PROD = NODE_ENV === "production";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "pluscms_token";

export const JWT_SECRET: string = (() => {
const v = process.env.JWT_SECRET;
if (!v) throw new Error("Missing required env: JWT_SECRET");
return v;
})();

/**
* Comma-separated list of allowed origins, e.g.
* CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"
*/
export const CORS_ORIGIN_RAW = String(process.env.CORS_ORIGIN || "").trim();
export const CORS_ORIGINS = CORS_ORIGIN_RAW
? CORS_ORIGIN_RAW.split(",")
.map((s) => s.trim())
.filter(Boolean)
: [];

// In production we REQUIRE a CORS allowlist (cookie auth needs this)
if (IS_PROD && CORS_ORIGINS.length === 0) {
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
export const USE_HOST_COOKIE_PREFIX =
IS_PROD &&
String(process.env.USE_HOST_COOKIE_PREFIX || "false").toLowerCase() === "true";

// Express trust proxy setting (important for req.ip / secure cookies behind TLS terminators)
export const TRUST_PROXY: any = (() => {
  const raw = String(process.env.TRUST_PROXY ?? "1").trim();
  // If it's a number-like string, return number.
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  // Otherwise allow Express' string options (e.g., "loopback")
  return raw;
})();

// Database
export const DB_HOST = process.env.DB_HOST || "127.0.0.1";
export const DB_PORT = Number(process.env.DB_PORT || 3306);
export const DB_USER = process.env.DB_USER || "root";
export const DB_PASS = process.env.DB_PASS || "";
export const DB_NAME = process.env.DB_NAME || "plus";
export const DB_CONNECTION_LIMIT = Math.max(
  1,
  Number(process.env.DB_CONNECTION_LIMIT || 10),
);

// 2FA + Turnstile
export const TWOFA_ENC_KEY = process.env.TWOFA_ENC_KEY || "";
export const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";

if (IS_PROD) {
  if (!TWOFA_ENC_KEY || TWOFA_ENC_KEY.length < 32) {
    throw new Error("Missing/weak env in production: TWOFA_ENC_KEY (32+ chars)");
  }
  if (!TURNSTILE_SECRET) {
    throw new Error("Missing required env in production: TURNSTILE_SECRET");
  }
}

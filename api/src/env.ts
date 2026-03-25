import dotenv from "dotenv";
import path from "path";

const envFile = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.resolve(process.cwd(), ".env");

dotenv.config({ path: envFile });

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(value);
}

function optional(name: string, fallback = "") {
  return String(process.env[name] ?? fallback);
}

function optionalNumber(name: string, fallback: number) {
  const raw = String(process.env[name] ?? fallback).trim();
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric env: ${name}`);
  }
  return value;
}

export const NODE_ENV = optional("NODE_ENV", "development");
export const IS_PROD = NODE_ENV === "production";
export const PORT = optionalNumber("PORT", 3002);

export const AUTH_COOKIE_NAME = optional("AUTH_COOKIE_NAME", "pluscms_token");
export const JWT_SECRET = required("JWT_SECRET");

export const CORS_ORIGIN_RAW = optional("CORS_ORIGIN", "").trim();
export const CORS_ORIGINS = CORS_ORIGIN_RAW
  ? CORS_ORIGIN_RAW.split(",").map((value) => value.trim()).filter(Boolean)
  : [];

if (IS_PROD && CORS_ORIGINS.length === 0) {
  throw new Error("Missing required env in production: CORS_ORIGIN");
}

export const USE_HOST_COOKIE_PREFIX =
  IS_PROD && optional("USE_HOST_COOKIE_PREFIX", "false").toLowerCase() === "true";

export const TRUST_PROXY: number | string = (() => {
  const raw = optional("TRUST_PROXY", "1").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
})();

export const DB_HOST = optional("DB_HOST", "127.0.0.1");
export const DB_PORT = optionalNumber("DB_PORT", 3306);
export const DB_USER = optional("DB_USER", "root");
export const DB_PASS = optional("DB_PASS", "");
export const DB_NAME = optional("DB_NAME", "plus");
export const DB_CONNECTION_LIMIT = Math.max(1, optionalNumber("DB_CONNECTION_LIMIT", 10));

export const NITRO_URL = optional("NITRO_URL", "http://localhost:3000");
export const TWOFA_ENC_KEY = optional("TWOFA_ENC_KEY", "");
export const TURNSTILE_SECRET = optional("TURNSTILE_SECRET", "");
export const TURNSTILE_ENABLED = TURNSTILE_SECRET.length > 0;

if (IS_PROD) {
  if (!TWOFA_ENC_KEY || TWOFA_ENC_KEY.length < 32) {
    throw new Error("Missing/weak env in production: TWOFA_ENC_KEY (32+ chars)");
  }
}

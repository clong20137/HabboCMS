"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TURNSTILE_ENABLED = exports.TURNSTILE_SECRET = exports.TWOFA_ENC_KEY = exports.INSTALLER_ENABLED = exports.NITRO_URL = exports.SITE_URL = exports.DB_CONNECTION_LIMIT = exports.DB_NAME = exports.DB_PASS = exports.DB_USER = exports.DB_PORT = exports.DB_HOST = exports.TRUST_PROXY = exports.USE_HOST_COOKIE_PREFIX = exports.CORS_ORIGINS = exports.CORS_ORIGIN_RAW = exports.JWT_SECRET = exports.AUTH_COOKIE_NAME = exports.PORT = exports.IS_PROD = exports.NODE_ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envFile = process.env.ENV_FILE
    ? path_1.default.resolve(process.env.ENV_FILE)
    : path_1.default.resolve(process.cwd(), ".env");
dotenv_1.default.config({ path: envFile });
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (value === undefined || String(value).trim() === "") {
        throw new Error(`Missing required env: ${name}`);
    }
    return String(value);
}
function optional(name, fallback = "") {
    return String(process.env[name] ?? fallback);
}
function optionalNumber(name, fallback) {
    const raw = String(process.env[name] ?? fallback).trim();
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid numeric env: ${name}`);
    }
    return value;
}
exports.NODE_ENV = optional("NODE_ENV", "development");
exports.IS_PROD = exports.NODE_ENV === "production";
exports.PORT = optionalNumber("PORT", 3002);
exports.AUTH_COOKIE_NAME = optional("AUTH_COOKIE_NAME", "pluscms_token");
exports.JWT_SECRET = required("JWT_SECRET");
exports.CORS_ORIGIN_RAW = optional("CORS_ORIGIN", "").trim();
exports.CORS_ORIGINS = exports.CORS_ORIGIN_RAW
    ? exports.CORS_ORIGIN_RAW.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
if (exports.IS_PROD && exports.CORS_ORIGINS.length === 0) {
    throw new Error("Missing required env in production: CORS_ORIGIN");
}
exports.USE_HOST_COOKIE_PREFIX = exports.IS_PROD && optional("USE_HOST_COOKIE_PREFIX", "false").toLowerCase() === "true";
exports.TRUST_PROXY = (() => {
    const raw = optional("TRUST_PROXY", "1").trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
})();
exports.DB_HOST = optional("DB_HOST", "127.0.0.1");
exports.DB_PORT = optionalNumber("DB_PORT", 3306);
exports.DB_USER = optional("DB_USER", "root");
exports.DB_PASS = optional("DB_PASS", "");
exports.DB_NAME = optional("DB_NAME", "plus");
exports.DB_CONNECTION_LIMIT = Math.max(1, optionalNumber("DB_CONNECTION_LIMIT", 10));
exports.SITE_URL = optional("SITE_URL", "").replace(/\/$/, "");
exports.NITRO_URL = optional("NITRO_URL", "http://localhost:3000");
exports.INSTALLER_ENABLED = optional("INSTALLER_ENABLED", exports.IS_PROD ? "false" : "true").toLowerCase() === "true";
exports.TWOFA_ENC_KEY = optional("TWOFA_ENC_KEY", "");
exports.TURNSTILE_SECRET = optional("TURNSTILE_SECRET", "");
exports.TURNSTILE_ENABLED = exports.TURNSTILE_SECRET.length > 0;
if (exports.IS_PROD) {
    if (!exports.TWOFA_ENC_KEY || exports.TWOFA_ENC_KEY.length < 32) {
        throw new Error("Missing/weak env in production: TWOFA_ENC_KEY (32+ chars)");
    }
}

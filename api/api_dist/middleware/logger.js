"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers['x-csrf-token']",
            "req.body.password",
            "req.body.confirmPassword",
            "req.body.captchaToken",
            "req.body.code",
            "req.body.setupToken",
            "req.body.dbPass",
        ],
        censor: "[REDACTED]",
    },
});
exports.httpLogger = (0, pino_http_1.default)({
    logger: exports.logger,
    genReqId: (req, res) => {
        // if requestIdMiddleware ran first, pino-http will reuse req.id
        const existing = req.id || req.headers["x-request-id"];
        if (existing)
            return String(existing);
        const id = cryptoRandomId();
        req.id = id;
        res.setHeader("X-Request-Id", id);
        return id;
    },
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500)
            return "error";
        if (res.statusCode >= 400)
            return "warn";
        return "info";
    },
});
function cryptoRandomId() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto");
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

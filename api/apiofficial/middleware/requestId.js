"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = __importDefault(require("crypto"));
function requestIdMiddleware(req, res, next) {
    const existing = String(req.headers["x-request-id"] || "").trim();
    const id = existing || (crypto_1.default.randomUUID ? crypto_1.default.randomUUID() : crypto_1.default.randomBytes(16).toString("hex"));
    req.id = id;
    res.setHeader("X-Request-Id", id);
    next();
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
const COOKIE_NAME = env_1.USE_HOST_COOKIE_PREFIX
    ? `__Host-${env_1.AUTH_COOKIE_NAME}`
    : env_1.AUTH_COOKIE_NAME;
function optionalAuth(req, _res, next) {
    try {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token)
            return next();
        const decoded = jsonwebtoken_1.default.verify(token, env_1.JWT_SECRET);
        req.user = decoded;
        return next();
    }
    catch {
        // ignore invalid cookies
        return next();
    }
}

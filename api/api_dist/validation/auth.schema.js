"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bLogin = exports.bRegister = exports.qCheckUsername = void 0;
const zod_1 = require("zod");
exports.qCheckUsername = zod_1.z.object({
    username: zod_1.z.string().trim().min(1).max(32),
});
const captchaToken = zod_1.z.string().trim().min(1, "Captcha token is required");
exports.bRegister = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(20),
    email: zod_1.z.string().trim().email().max(200),
    password: zod_1.z.string().min(6).max(100),
    confirmPassword: zod_1.z.string().min(6).max(100),
    betaCode: zod_1.z.string().trim().max(64).optional().default(""),
    captchaToken,
});
exports.bLogin = zod_1.z.object({
    username: zod_1.z.string().trim().min(1).max(32),
    password: zod_1.z.string().min(1).max(100),
    captchaToken,
});

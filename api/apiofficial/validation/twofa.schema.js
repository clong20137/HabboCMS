"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bVerifyLogin2FA = void 0;
const zod_1 = require("zod");
exports.bVerifyLogin2FA = zod_1.z.object({
    challengeId: zod_1.z.string().min(10),
    code: zod_1.z.string().min(6).max(12),
});

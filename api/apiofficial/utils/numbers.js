"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampInt = clampInt;
function clampInt(n, min, max, fallback) {
    const num = Number(n);
    if (!Number.isFinite(num))
        return fallback;
    return Math.min(Math.max(Math.trunc(num), min), max);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
function ok(res, payload = {}) {
    return res.json({ ok: true, ...payload });
}

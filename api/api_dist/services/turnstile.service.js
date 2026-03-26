"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTurnstileToken = verifyTurnstileToken;
const env_1 = require("../env");
async function verifyTurnstileToken(token, remoteIp) {
    const captchaToken = String(token || "").trim();
    if (!env_1.TURNSTILE_ENABLED) {
        return { success: true, skipped: true, errors: [] };
    }
    if (!captchaToken) {
        return { success: false, skipped: false, errors: ["missing-input-response"] };
    }
    const body = new URLSearchParams();
    body.set("secret", env_1.TURNSTILE_SECRET);
    body.set("response", captchaToken);
    if (remoteIp)
        body.set("remoteip", remoteIp);
    try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });
        const data = (await response.json());
        return {
            success: !!data?.success,
            skipped: false,
            errors: Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [],
        };
    }
    catch {
        return { success: false, skipped: false, errors: ["turnstile-request-failed"] };
    }
}

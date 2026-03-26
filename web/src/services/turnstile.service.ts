import { TURNSTILE_ENABLED, TURNSTILE_SECRET } from "../env";

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(token?: string, remoteIp?: string) {
  const captchaToken = String(token || "").trim();

  if (!TURNSTILE_ENABLED) {
    return { success: true, skipped: true, errors: [] as string[] };
  }

  if (!captchaToken) {
    return { success: false, skipped: false, errors: ["missing-input-response"] };
  }

  const body = new URLSearchParams();
  body.set("secret", TURNSTILE_SECRET);
  body.set("response", captchaToken);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = (await response.json()) as TurnstileResponse;

    return {
      success: !!data?.success,
      skipped: false,
      errors: Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [],
    };
  } catch {
    return { success: false, skipped: false, errors: ["turnstile-request-failed"] };
  }
}

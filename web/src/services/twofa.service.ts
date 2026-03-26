import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import {
  encryptString,
  decryptString,
  randomBackupCode,
  sha256,
} from "../utils/cryptos";

const ISSUER = "PlusCMS";
const TOTP_PERIOD = 30; // seconds
const TOTP_TOLERANCE_SECONDS = 30; // +/- 1 step drift

export async function generateSetup(username: string) {
  const secret = generateSecret();

  // Create standard otpauth URI (works with your otplib typings)
  const otpauth = generateURI({
    issuer: ISSUER,
    label: username,
    secret,
    strategy: "totp",
    period: TOTP_PERIOD,
  });

  const qrDataUrl = await QRCode.toDataURL(otpauth);

  const backupCodesPlain = Array.from({ length: 8 }, () => randomBackupCode());
  const backupCodesHashed = backupCodesPlain.map((c) => sha256(c));

  return {
    secretEnc: encryptString(secret),
    otpauth,
    qrDataUrl,
    backupCodesPlain,
    backupCodesHashed,
  };
}

export function verifyTotp(secretEnc: string, code: string) {
  const secret = decryptString(secretEnc);
  const token = String(code || "")
    .replace(/\s/g, "")
    .trim();

  if (!token || token.length < 6) return false;

  try {
    // verifySync differs across otplib versions:
    // - may return boolean
    // - may return { valid: boolean }
    // - may throw
    const result: any = verifySync({
      secret,
      token,
      strategy: "totp",
      period: TOTP_PERIOD,
      epochTolerance: TOTP_TOLERANCE_SECONDS,
    });

    if (typeof result === "boolean") return result;
    if (result && typeof result === "object") {
      if (typeof result.valid === "boolean") return result.valid;
      // some versions might return { delta: number } on success, etc.
      if (typeof result.delta === "number") return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function verifyBackupCode(backupCodesHashed: string[], code: string) {
  const clean = String(code || "")
    .trim()
    .toUpperCase();
  const hashed = sha256(clean);
  const idx = backupCodesHashed.indexOf(hashed);
  return { ok: idx !== -1, idx };
}

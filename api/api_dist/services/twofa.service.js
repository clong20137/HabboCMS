"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSetup = generateSetup;
exports.verifyTotp = verifyTotp;
exports.verifyBackupCode = verifyBackupCode;
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const cryptos_1 = require("../utils/cryptos");
const ISSUER = "PlusCMS";
const TOTP_PERIOD = 30; // seconds
const TOTP_TOLERANCE_SECONDS = 30; // +/- 1 step drift
async function generateSetup(username) {
    const secret = (0, otplib_1.generateSecret)();
    // Create standard otpauth URI (works with your otplib typings)
    const otpauth = (0, otplib_1.generateURI)({
        issuer: ISSUER,
        label: username,
        secret,
        strategy: "totp",
        period: TOTP_PERIOD,
    });
    const qrDataUrl = await qrcode_1.default.toDataURL(otpauth);
    const backupCodesPlain = Array.from({ length: 8 }, () => (0, cryptos_1.randomBackupCode)());
    const backupCodesHashed = backupCodesPlain.map((c) => (0, cryptos_1.sha256)(c));
    return {
        secretEnc: (0, cryptos_1.encryptString)(secret),
        otpauth,
        qrDataUrl,
        backupCodesPlain,
        backupCodesHashed,
    };
}
function verifyTotp(secretEnc, code) {
    const secret = (0, cryptos_1.decryptString)(secretEnc);
    const token = String(code || "")
        .replace(/\s/g, "")
        .trim();
    if (!token || token.length < 6)
        return false;
    try {
        // verifySync differs across otplib versions:
        // - may return boolean
        // - may return { valid: boolean }
        // - may throw
        const result = (0, otplib_1.verifySync)({
            secret,
            token,
            strategy: "totp",
            period: TOTP_PERIOD,
            epochTolerance: TOTP_TOLERANCE_SECONDS,
        });
        if (typeof result === "boolean")
            return result;
        if (result && typeof result === "object") {
            if (typeof result.valid === "boolean")
                return result.valid;
            // some versions might return { delta: number } on success, etc.
            if (typeof result.delta === "number")
                return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
function verifyBackupCode(backupCodesHashed, code) {
    const clean = String(code || "")
        .trim()
        .toUpperCase();
    const hashed = (0, cryptos_1.sha256)(clean);
    const idx = backupCodesHashed.indexOf(hashed);
    return { ok: idx !== -1, idx };
}

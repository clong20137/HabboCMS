import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const key = process.env.TWOFA_ENC_KEY;
  if (!key || key.length < 32) {
    throw new Error("Missing/weak TWOFA_ENC_KEY (must be 32+ chars)");
  }
  // 32 bytes
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // iv.tag.data (base64)
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64)
    throw new Error("Invalid encrypted payload");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomBase32(bytes = 20) {
  // base32-like charset (no confusing chars)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const buf = crypto.randomBytes(bytes);
  let out = "";
  for (let i = 0; i < buf.length; i++)
    out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function randomBackupCode() {
  // readable: XXXX-XXXX
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

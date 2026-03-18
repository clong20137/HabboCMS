import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const INSTALL_DIR = path.resolve(process.cwd(), '.pluscms');
const LOCK_FILE = path.join(INSTALL_DIR, 'installed.json');
const TOKEN_FILE = path.join(INSTALL_DIR, 'setup-token.txt');

async function ensureDir() {
  await fs.mkdir(INSTALL_DIR, { recursive: true });
}

export function getInstallTokenHint() {
  return path.relative(process.cwd(), TOKEN_FILE) || TOKEN_FILE;
}

export async function isInstalled() {
  try {
    await fs.access(LOCK_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function readInstallMeta() {
  try {
    const raw = await fs.readFile(LOCK_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readSetupToken() {
  if (await isInstalled()) return '';

  if (process.env.INSTALL_SETUP_TOKEN?.trim()) {
    return process.env.INSTALL_SETUP_TOKEN.trim();
  }

  try {
    return (await fs.readFile(TOKEN_FILE, 'utf8')).trim();
  } catch {
    await ensureDir();
    const token = crypto.randomBytes(24).toString('hex');
    await fs.writeFile(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
    return token;
  }
}

export async function ensureSetupTokenLogged() {
  if (await isInstalled()) return;
  const token = await readSetupToken();
  console.log(`[PlusCMS] Setup token: ${token}`);
  console.log(`[PlusCMS] Token file: ${getInstallTokenHint()}`);
}

export async function markInstalled(meta: Record<string, unknown>) {
  await ensureDir();
  await fs.writeFile(
    LOCK_FILE,
    `${JSON.stringify({ installed: true, installedAt: new Date().toISOString(), ...meta }, null, 2)}\n`,
    { mode: 0o600 },
  );

  try {
    await fs.rm(TOKEN_FILE, { force: true });
  } catch {}
}

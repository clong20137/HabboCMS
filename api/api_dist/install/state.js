"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstallTokenHint = getInstallTokenHint;
exports.isInstalled = isInstalled;
exports.readInstallMeta = readInstallMeta;
exports.readSetupToken = readSetupToken;
exports.ensureSetupTokenLogged = ensureSetupTokenLogged;
exports.markInstalled = markInstalled;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const INSTALL_DIR = path_1.default.resolve(process.cwd(), '.pluscms');
const LOCK_FILE = path_1.default.join(INSTALL_DIR, 'installed.json');
const TOKEN_FILE = path_1.default.join(INSTALL_DIR, 'setup-token.txt');
async function ensureDir() {
    await promises_1.default.mkdir(INSTALL_DIR, { recursive: true });
}
function getInstallTokenHint() {
    return path_1.default.relative(process.cwd(), TOKEN_FILE) || TOKEN_FILE;
}
async function isInstalled() {
    try {
        await promises_1.default.access(LOCK_FILE);
        return true;
    }
    catch {
        return false;
    }
}
async function readInstallMeta() {
    try {
        const raw = await promises_1.default.readFile(LOCK_FILE, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function readSetupToken() {
    if (await isInstalled())
        return '';
    if (process.env.INSTALL_SETUP_TOKEN?.trim()) {
        return process.env.INSTALL_SETUP_TOKEN.trim();
    }
    try {
        return (await promises_1.default.readFile(TOKEN_FILE, 'utf8')).trim();
    }
    catch {
        await ensureDir();
        const token = crypto_1.default.randomBytes(24).toString('hex');
        await promises_1.default.writeFile(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
        return token;
    }
}
async function ensureSetupTokenLogged() {
    if (await isInstalled())
        return;
    const token = await readSetupToken();
    console.log(`[PlusCMS] Setup token: ${token}`);
    console.log(`[PlusCMS] Token file: ${getInstallTokenHint()}`);
}
async function markInstalled(meta) {
    await ensureDir();
    await promises_1.default.writeFile(LOCK_FILE, `${JSON.stringify({ installed: true, installedAt: new Date().toISOString(), ...meta }, null, 2)}\n`, { mode: 0o600 });
    try {
        await promises_1.default.rm(TOKEN_FILE, { force: true });
    }
    catch { }
}

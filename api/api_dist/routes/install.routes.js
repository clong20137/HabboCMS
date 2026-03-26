"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installRouter = void 0;
const express_1 = __importDefault(require("express"));
const state_1 = require("../install/state");
const env_1 = require("../env");
const service_1 = require("../install/service");
exports.installRouter = express_1.default.Router();
exports.installRouter.use(async (_req, res, next) => {
    if (!env_1.INSTALLER_ENABLED) {
        return res.status(404).json({ ok: false, error: 'Installer is disabled.' });
    }
    return next();
});
function isLoopback(ip) {
    const value = String(ip || '').toLowerCase();
    return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1' || value.endsWith('127.0.0.1');
}
async function ensureAuthorized(req, providedToken) {
    const requestIp = String(req.ip || '');
    const remoteIp = String(req.socket.remoteAddress || '');
    if (isLoopback(requestIp) || isLoopback(remoteIp))
        return;
    const token = await (0, state_1.readSetupToken)();
    if (!token || token !== String(providedToken || '').trim()) {
        const err = new Error('Invalid setup token.');
        err.status = 403;
        throw err;
    }
}
function toInput(req) {
    return {
        setupToken: String(req.body?.setupToken || ''),
        dbHost: String(req.body?.dbHost || ''),
        dbPort: Number(req.body?.dbPort || 3306),
        dbName: String(req.body?.dbName || ''),
        dbUser: String(req.body?.dbUser || ''),
        dbPass: String(req.body?.dbPass || ''),
        siteUrl: String(req.body?.siteUrl || ''),
        hotelName: String(req.body?.hotelName || ''),
        nitroUrl: String(req.body?.nitroUrl || ''),
        adminUsername: String(req.body?.adminUsername || ''),
        adminEmail: String(req.body?.adminEmail || ''),
        adminPassword: String(req.body?.adminPassword || ''),
        confirmPassword: String(req.body?.confirmPassword || ''),
        requestIp: String(req.ip || ''),
    };
}
exports.installRouter.get('/status', async (_req, res) => {
    const installed = await (0, state_1.isInstalled)();
    return res.json({ ok: true, installed, setupTokenHint: installed ? null : (0, state_1.getInstallTokenHint)() });
});
exports.installRouter.post('/test', async (req, res, next) => {
    try {
        if (await (0, state_1.isInstalled)()) {
            return res.status(409).json({ ok: false, error: 'CMS is already installed.' });
        }
        await ensureAuthorized(req, String(req.body?.setupToken || ''));
        const result = await (0, service_1.preflightInstall)(toInput(req));
        return res.json(result);
    }
    catch (error) {
        return next(error);
    }
});
exports.installRouter.post('/run', async (req, res, next) => {
    try {
        if (await (0, state_1.isInstalled)()) {
            return res.status(409).json({ ok: false, error: 'CMS is already installed.' });
        }
        await ensureAuthorized(req, String(req.body?.setupToken || ''));
        const result = await (0, service_1.runInstall)(toInput(req));
        await (0, state_1.markInstalled)({ adminUserId: result.adminUserId, dbName: String(req.body?.dbName || ''), siteUrl: String(req.body?.siteUrl || '') });
        return res.json({
            ok: true,
            message: 'Installation complete. Restart the API process once before first login.',
        });
    }
    catch (error) {
        return next(error);
    }
});

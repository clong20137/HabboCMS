import express from 'express';
import { readSetupToken, isInstalled, markInstalled, getInstallTokenHint } from '../install/state';
import { INSTALLER_ENABLED } from '../env';
import { preflightInstall, runInstall } from '../install/service';

export const installRouter = express.Router();

installRouter.use(async (_req, res, next) => {
  if (!INSTALLER_ENABLED) {
    return res.status(404).json({ ok: false, error: 'Installer is disabled.' });
  }
  return next();
});

function isLoopback(ip: string) {
  const value = String(ip || '').toLowerCase();
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1' || value.endsWith('127.0.0.1');
}

async function ensureAuthorized(req: express.Request, providedToken: string) {
  const requestIp = String(req.ip || '');
  const remoteIp = String(req.socket.remoteAddress || '');
  if (isLoopback(requestIp) || isLoopback(remoteIp)) return;
  const token = await readSetupToken();
  if (!token || token !== String(providedToken || '').trim()) {
    const err: any = new Error('Invalid setup token.');
    err.status = 403;
    throw err;
  }
}

function toInput(req: express.Request) {
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

installRouter.get('/status', async (_req, res) => {
  const installed = await isInstalled();
  return res.json({ ok: true, installed, setupTokenHint: installed ? null : getInstallTokenHint() });
});

installRouter.post('/test', async (req, res, next) => {
  try {
    if (await isInstalled()) {
      return res.status(409).json({ ok: false, error: 'CMS is already installed.' });
    }
    await ensureAuthorized(req, String(req.body?.setupToken || ''));
    const result = await preflightInstall(toInput(req));
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

installRouter.post('/run', async (req, res, next) => {
  try {
    if (await isInstalled()) {
      return res.status(409).json({ ok: false, error: 'CMS is already installed.' });
    }

    await ensureAuthorized(req, String(req.body?.setupToken || ''));
    const result = await runInstall(toInput(req));
    await markInstalled({ adminUserId: result.adminUserId, dbName: String(req.body?.dbName || ''), siteUrl: String(req.body?.siteUrl || '') });

    return res.json({
      ok: true,
      message: 'Installation complete. Restart the API process once before first login.',
    });
  } catch (error) {
    return next(error);
  }
});

# BareCMS Production Hardening Audit

## Completed hardening

- Added server-side HTML sanitization for Housekeeping news create/update to reduce stored XSS risk.
- Added mutation origin validation on top of CSRF protection.
- Hardened auth cookies with `Priority=High` and safer cookie clearing for both regular and `__Host-` names.
- Disabled installer by default in production and made the installer write production-safe environment defaults.
- Added `SITE_URL` and `INSTALLER_ENABLED` environment support.
- Expanded log redaction for secrets and sensitive request bodies.
- Fixed frontend production build blockers:
  - removed unused imports failing TypeScript build
  - corrected `Tickets.scss` import case mismatch
  - added proper Sass dependency for the web build
- Updated `.env.example` files for production deployment defaults.

## Build status

- API TypeScript build: passed
- Web production build: passed

## Remaining production recommendations

1. Put the API behind HTTPS and a reverse proxy such as Nginx, Caddy, Cloudflare, or an ALB.
2. Store secrets in your deployment secret manager, not in `.env` files committed to repos or packed into release zips.
3. Use a shared rate-limit store such as Redis if you run multiple API instances.
4. Add centralized monitoring and alerts for 5xx spikes, auth failures, and installer access attempts.
5. Consider splitting the web bundle with dynamic imports because the main JS bundle is large.
6. Resolve runtime asset references for `/assets/icons/lock.svg` and `/assets/icons/wave.svg` if those files are expected in production.
7. Add a CSP tuned to your final asset domains once hosting topology is finalized.
8. Rotate any secrets that were previously stored in uploaded `.env` files before going live.

## Files changed

- `api/src/utils/html.ts`
- `api/src/env.ts`
- `api/src/security.ts`
- `api/src/auth.ts`
- `api/src/routes/install.routes.ts`
- `api/src/install/service.ts`
- `api/src/housekeeping/router.ts`
- `api/src/middleware/logger.ts`
- `api/.env.example`
- `web/src/App.tsx`
- `web/src/pages/Tickets.tsx`
- `web/package.json`
- `web/.env.example`

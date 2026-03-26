import express from "express";

import { applySecurity, csrfIssueToken } from "./security";
import { errorHandler } from "./errors/errorHandler";
import { hkRouter } from "./housekeeping/router";

import { authRouter } from "./routes/auth.routes";
import { twofaRouter } from "./routes/twofa.routes";
import { configRouter } from "./routes/config.routes";
import { miscRouter } from "./routes/misc.routes";
import { leaderboardsRouter } from "./routes/leaderboards.routes";
import { newsRouter } from "./routes/news.routes";
import { ticketsRouter } from "./routes/tickets.routes";
import { staffRouter } from "./routes/staff.routes";
import { installRouter } from "./routes/install.routes";
import { liveFeedRouter } from "./routes/liveFeed.routes";

export function createApp() {
  const app = express();

  // Global security layer (helmet, CORS allowlist, JSON limit, cookies, CSRF, HPP, logging)
  applySecurity(app);

  // CSRF token issuer (client calls this once, then sends X-CSRF-Token on mutations)
  app.get("/api/auth/csrf", csrfIssueToken);

  // Public installer routes (first-run only)
  app.use("/api/install", installRouter);

  // Routers
  app.use("/api/hk", hkRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/2fa", twofaRouter); 
  app.use("/api", configRouter);
  app.use("/api", miscRouter);
  app.use("/api", leaderboardsRouter);
  app.use("/api", newsRouter);
  app.use("/api", ticketsRouter);
  app.use("/api", staffRouter);
  app.use("/api", liveFeedRouter);

  app.get("/api/user", (_req, res) => {
    res.redirect(307, "/api/auth/me");
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const security_1 = require("./security");
const errorHandler_1 = require("./errors/errorHandler");
const router_1 = require("./housekeeping/router");
const auth_routes_1 = require("./routes/auth.routes");
const twofa_routes_1 = require("./routes/twofa.routes");
const config_routes_1 = require("./routes/config.routes");
const misc_routes_1 = require("./routes/misc.routes");
const leaderboards_routes_1 = require("./routes/leaderboards.routes");
const news_routes_1 = require("./routes/news.routes");
const tickets_routes_1 = require("./routes/tickets.routes");
const staff_routes_1 = require("./routes/staff.routes");
const install_routes_1 = require("./routes/install.routes");
function createApp() {
    const app = (0, express_1.default)();
    // Global security layer (helmet, CORS allowlist, JSON limit, cookies, CSRF, HPP, logging)
    (0, security_1.applySecurity)(app);
    // CSRF token issuer (client calls this once, then sends X-CSRF-Token on mutations)
    app.get("/api/auth/csrf", security_1.csrfIssueToken);
    // Public installer routes (first-run only)
    app.use("/api/install", install_routes_1.installRouter);
    // Routers
    app.use("/api/hk", router_1.hkRouter);
    app.use("/api/auth", auth_routes_1.authRouter);
    app.use("/api/2fa", twofa_routes_1.twofaRouter);
    app.use("/api", config_routes_1.configRouter);
    app.use("/api", misc_routes_1.miscRouter);
    app.use("/api", leaderboards_routes_1.leaderboardsRouter);
    app.use("/api", news_routes_1.newsRouter);
    app.use("/api", tickets_routes_1.ticketsRouter);
    app.use("/api", staff_routes_1.staffRouter);
    app.get("/api/user", (_req, res) => {
        res.redirect(307, "/api/auth/me");
    });
    // Global error handler
    app.use(errorHandler_1.errorHandler);
    return app;
}

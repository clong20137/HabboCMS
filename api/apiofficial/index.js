"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const state_1 = require("./install/state");
const app = (0, app_1.createApp)();
const port = Number(process.env.PORT || 3001);
app.listen(port, async () => {
    console.log(`PlusCMS API running on http://localhost:${port}`);
    await (0, state_1.ensureSetupTokenLogged)();
});

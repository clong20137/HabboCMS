"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./env");
const state_1 = require("./install/state");
const app = (0, app_1.createApp)();
app.listen(env_1.PORT, async () => {
    console.log(`PlusCMS API running on http://localhost:${env_1.PORT}`);
    await (0, state_1.ensureSetupTokenLogged)();
});

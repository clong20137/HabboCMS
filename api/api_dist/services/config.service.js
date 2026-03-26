"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteConfig = getSiteConfig;
exports.getClientConfig = getClientConfig;
const env_1 = require("../env");
const cmsSettings_1 = require("../utils/cmsSettings");
async function getSiteConfig(pool) {
    const hotelName = await (0, cmsSettings_1.getCmsSetting)(pool, "hotel_name", "Hotel");
    return { hotelName };
}
function getClientConfig() {
    return {
        nitroUrl: env_1.NITRO_URL,
        turnstileEnabled: env_1.TURNSTILE_ENABLED,
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlineCount = onlineCount;
const serverStatus_repo_1 = require("../repositories/serverStatus.repo");
async function onlineCount(pool) {
    return (0, serverStatus_repo_1.getOnlineCount)(pool);
}

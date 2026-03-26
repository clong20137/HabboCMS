"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../env");
exports.pool = promise_1.default.createPool({
    host: env_1.DB_HOST,
    user: env_1.DB_USER,
    password: env_1.DB_PASS,
    database: env_1.DB_NAME,
    port: env_1.DB_PORT,
    waitForConnections: true,
    connectionLimit: env_1.DB_CONNECTION_LIMIT,
    queueLimit: 0,
});

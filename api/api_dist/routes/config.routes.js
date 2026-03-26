"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const asyncHandler_1 = require("../middleware/asyncHandler");
const configService = __importStar(require("../services/config.service"));
exports.configRouter = express_1.default.Router();
exports.configRouter.get("/health", (_req, res) => res.json({ ok: true }));
exports.configRouter.get("/client/config", (_req, res) => {
    res.json({ ok: true, ...configService.getClientConfig() });
});
exports.configRouter.get("/site-config", (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    try {
        const cfg = await configService.getSiteConfig(db_1.pool);
        return res.json({ ok: true, ...cfg });
    }
    catch {
        return res.json({ ok: true, hotelName: "Hotel" });
    }
}));

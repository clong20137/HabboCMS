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
exports.newsRouter = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../auth");
const optionalAuth_1 = require("../middleware/optionalAuth");
const limiters_1 = require("../middleware/limiters");
const asyncHandler_1 = require("../middleware/asyncHandler");
const validate_1 = require("../middleware/validate");
const AppError_1 = require("../errors/AppError");
const newsService = __importStar(require("../services/news.service"));
exports.newsRouter = express_1.default.Router();
const pNewsId = zod_1.z.object({
    id: (0, validate_1.zInt)({ min: 1 }),
});
const qLimit10 = zod_1.z.object({
    limit: (0, validate_1.zInt)({ min: 1, max: 10 }).optional(),
});
const qLimit12 = zod_1.z.object({
    limit: (0, validate_1.zInt)({ min: 1, max: 12 }).optional(),
});
const qLimit100 = zod_1.z.object({
    limit: (0, validate_1.zInt)({ min: 1, max: 100 }).optional(),
});
const bCreateComment = zod_1.z
    .object({
    body: zod_1.z
        .string()
        .trim()
        .min(2, "Comment is too short.")
        .max(1000, "Comment is too long.")
        .optional(),
    message: zod_1.z.string().trim().min(2).max(1000).optional(),
})
    .transform((v) => ({ body: (v.body ?? v.message ?? "").trim() }))
    .refine((v) => v.body.length >= 2, { message: "Comment is required." });
const pCommentId = zod_1.z.object({
    commentId: (0, validate_1.zInt)({ min: 1 }),
});
const bToggleReaction = zod_1.z.object({
    reaction: zod_1.z
        .string()
        .trim()
        .min(1, "Reaction is required.")
        .max(32, "Reaction is too long."),
});
exports.newsRouter.get("/news", (0, validate_1.validateQuery)(qLimit10), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const limit = Number(req.query.limit ?? 3);
    const items = await newsService.listNews(db_1.pool, limit);
    return res.json({ ok: true, items });
}));
exports.newsRouter.get("/news/:id", (0, validate_1.validateParams)(pNewsId), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.id);
    const item = await newsService.getNews(db_1.pool, id);
    if (!item)
        throw (0, AppError_1.notFound)("Not found");
    return res.json({ ok: true, item });
}));
exports.newsRouter.get("/news/:id/recent", (0, validate_1.validateParams)(pNewsId), (0, validate_1.validateQuery)(qLimit12), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const currentId = Number(req.params.id);
    const limit = Number(req.query.limit ?? 6);
    const items = await newsService.listRecent(db_1.pool, currentId, limit);
    return res.json({ ok: true, items });
}));
// Comments
exports.newsRouter.get("/news/:id/comments", optionalAuth_1.optionalAuth, (0, validate_1.validateParams)(pNewsId), (0, validate_1.validateQuery)(qLimit100), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const newsId = Number(req.params.id);
    const limit = Number(req.query.limit ?? 50);
    const viewer = req.user;
    const items = await newsService.listComments(db_1.pool, {
        newsId,
        limit,
        viewerUserId: viewer?.id,
    });
    return res.json({ ok: true, items });
}));
exports.newsRouter.post("/news/:id/comments", auth_1.requireAuth, limiters_1.commentLimiter, (0, validate_1.validateParams)(pNewsId), (0, validate_1.validateBody)(bCreateComment), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const newsId = Number(req.params.id);
    const u = req.user;
    const { body } = req.body;
    const item = await newsService.addComment(db_1.pool, {
        newsId,
        userId: u.id,
        username: u.username,
        body,
    });
    return res.json({ ok: true, item });
}));
exports.newsRouter.post("/news/comments/:commentId/reactions/toggle", auth_1.requireAuth, limiters_1.reactionLimiter, (0, validate_1.validateParams)(pCommentId), (0, validate_1.validateBody)(bToggleReaction), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const commentId = Number(req.params.commentId);
    const u = req.user;
    const { reaction } = req.body;
    const out = await newsService.toggleReaction(db_1.pool, {
        commentId,
        userId: u.id,
        reaction,
    });
    return res.json({ ok: true, ...out });
}));

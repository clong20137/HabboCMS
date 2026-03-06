import express from "express";
import { z } from "zod";

import { pool } from "../db";
import { requireAuth } from "../auth";
import { optionalAuth } from "../middleware/optionalAuth";
import { commentLimiter, reactionLimiter } from "../middleware/limiters";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateBody, validateParams, validateQuery, zInt } from "../middleware/validate";
import { notFound } from "../errors/AppError";
import * as newsService from "../services/news.service";

export const newsRouter = express.Router();

const pNewsId = z.object({
  id: zInt({ min: 1 }),
});

const qLimit10 = z.object({
  limit: zInt({ min: 1, max: 10 }).optional(),
});

const qLimit12 = z.object({
  limit: zInt({ min: 1, max: 12 }).optional(),
});

const qLimit100 = z.object({
  limit: zInt({ min: 1, max: 100 }).optional(),
});

const bCreateComment = z
  .object({
    body: z
      .string()
      .trim()
      .min(2, "Comment is too short.")
      .max(1000, "Comment is too long.")
      .optional(),
    message: z.string().trim().min(2).max(1000).optional(),
  })
  .transform((v) => ({ body: (v.body ?? v.message ?? "").trim() }))
  .refine((v) => v.body.length >= 2, { message: "Comment is required." });

const pCommentId = z.object({
  commentId: zInt({ min: 1 }),
});

const bToggleReaction = z.object({
  reaction: z.enum(["thumbs_up", "smile"]),
});

newsRouter.get(
  "/news",
  validateQuery(qLimit10),
  asyncHandler(async (req, res) => {
    const limit = Number((req.query as any).limit ?? 3);
    const items = await newsService.listNews(pool, limit);
    return res.json({ ok: true, items });
  }),
);

newsRouter.get(
  "/news/:id",
  validateParams(pNewsId),
  asyncHandler(async (req, res) => {
    const id = Number((req.params as any).id);
    const item = await newsService.getNews(pool, id);
    if (!item) throw notFound("Not found");
    return res.json({ ok: true, item });
  }),
);

newsRouter.get(
  "/news/:id/recent",
  validateParams(pNewsId),
  validateQuery(qLimit12),
  asyncHandler(async (req, res) => {
    const currentId = Number((req.params as any).id);
    const limit = Number((req.query as any).limit ?? 6);
    const items = await newsService.listRecent(pool, currentId, limit);
    return res.json({ ok: true, items });
  }),
);

// Comments
newsRouter.get(
  "/news/:id/comments",
  optionalAuth,
  validateParams(pNewsId),
  validateQuery(qLimit100),
  asyncHandler(async (req, res) => {
    const newsId = Number((req.params as any).id);
    const limit = Number((req.query as any).limit ?? 50);
    const viewer = (req as any).user as { id: number } | undefined;

    const items = await newsService.listComments(pool, {
      newsId,
      limit,
      viewerUserId: viewer?.id,
    });

    return res.json({ ok: true, items });
  }),
);

newsRouter.post(
  "/news/:id/comments",
  requireAuth,
  commentLimiter,
  validateParams(pNewsId),
  validateBody(bCreateComment),
  asyncHandler(async (req, res) => {
    const newsId = Number((req.params as any).id);
    const u = (req as any).user as { id: number; username: string };
    const { body } = req.body as any;

    const item = await newsService.addComment(pool, {
      newsId,
      userId: u.id,
      username: u.username,
      body,
    });

    return res.json({ ok: true, item });
  }),
);

newsRouter.post(
  "/news/comments/:commentId/reactions/toggle",
  requireAuth,
  reactionLimiter,
  validateParams(pCommentId),
  validateBody(bToggleReaction),
  asyncHandler(async (req, res) => {
    const commentId = Number((req.params as any).commentId);
    const u = (req as any).user as { id: number };
    const { reaction } = req.body as any;

    const out = await newsService.toggleReaction(pool, {
      commentId,
      userId: u.id,
      reaction,
    });

    return res.json({ ok: true, ...out });
  }),
);

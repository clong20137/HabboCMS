import express from "express";

import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import * as liveFeedService from "../services/liveFeed.service";

export const liveFeedRouter = express.Router();

liveFeedRouter.get(
  "/live-feed",
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;

    try {
      const items = await liveFeedService.getLiveFeed(pool, limit);
      return res.json({ ok: true, items });
    } catch {
      return res.json({ ok: true, items: [] });
    }
  }),
);

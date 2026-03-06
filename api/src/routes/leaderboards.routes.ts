import express from "express";
import { z } from "zod";

import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateParams, validateQuery, zInt } from "../middleware/validate";
import * as leaderboardsService from "../services/leaderboards.service";

export const leaderboardsRouter = express.Router();

const pField = z.object({
  field: z.string().trim().min(1).max(64),
});

const qLimit = z.object({
  limit: zInt({ min: 1, max: 50 }).optional(),
});

leaderboardsRouter.get(
  "/leaderboards/:field",
  validateParams(pField),
  validateQuery(qLimit),
  asyncHandler(async (req, res) => {
    const field = String((req.params as any).field || "").trim();
    const limit = Number((req.query as any).limit ?? 10);

    const items = await leaderboardsService.getLeaderboard(pool, { field, limit });
    return res.json({ ok: true, field, items });
  }),
);

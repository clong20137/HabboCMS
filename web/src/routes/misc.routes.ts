import express from "express";

import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import * as miscService from "../services/misc.service";

export const miscRouter = express.Router();

miscRouter.get(
  "/online-count",
  asyncHandler(async (_req, res) => {
    try {
      const online = await miscService.onlineCount(pool);
      return res.json({ ok: true, online: Number(online) || 0 });
    } catch {
      // Never let the site UI crash from this endpoint
      return res.json({ ok: true, online: 0 });
    }
  }),
);

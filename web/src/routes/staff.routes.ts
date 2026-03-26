import express from "express";

import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import * as staffService from "../services/staff.service";

export const staffRouter = express.Router();

staffRouter.get(
  "/staff",
  asyncHandler(async (_req, res) => {
    const staff = await staffService.getStaff(pool, 4);
    return res.json({ ok: true, staff });
  }),
);

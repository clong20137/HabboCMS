import express from "express";

import { pool } from "../db";
import { asyncHandler } from "../middleware/asyncHandler";
import * as configService from "../services/config.service";

export const configRouter = express.Router();

configRouter.get("/health", (_req, res) => res.json({ ok: true }));

configRouter.get("/client/config", (_req, res) => {
  res.json({ ok: true, ...configService.getClientConfig() });
});

configRouter.get(
  "/site-config",
  asyncHandler(async (_req, res) => {
    try {
      const cfg = await configService.getSiteConfig(pool);
      return res.json({ ok: true, ...cfg });
    } catch {
      return res.json({ ok: true, hotelName: "Hotel" });
    }
  }),
);

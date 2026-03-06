import type { Response } from "express";

export function ok(res: Response, payload: Record<string, unknown> = {}) {
  return res.json({ ok: true, ...payload });
}

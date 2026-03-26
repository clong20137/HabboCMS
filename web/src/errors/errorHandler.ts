import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

import { ApiError } from "./ApiError";
import { logger } from "../middleware/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).id || String(req.headers["x-request-id"] || "");

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: "Invalid request data",
      code: "VALIDATION_ERROR",
      issues: err.issues,
      requestId,
    });
  }

  // Known API errors
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      ok: false,
      error: err.message,
      code: err.code,
      details: err.details,
      requestId,
    });
  }

  const anyErr = err as any;
  const status = Number(anyErr?.status || anyErr?.statusCode || 500);
  const message = status >= 500 ? "Server error" : String(anyErr?.message || "Request failed");
  const code = status < 500 ? anyErr?.code : undefined;
  const details = status < 500 ? anyErr?.details : undefined;

  // Log unexpected errors with request id context
  if (status >= 500) {
    logger.error(
      {
        requestId,
        err: anyErr,
        path: req.path,
        method: req.method,
      },
      "Unhandled error",
    );
  }

  return res.status(status).json({ ok: false, error: message, code, details, requestId });
}

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Accept schemas where input/output differ (ZodEffects, preprocess, transforms, etc.)
type AnyZodSchema<T> = z.ZodType<T, any, any>;

/**
 * Validates and replaces req.body with parsed result.
 */
export function validateBody<T>(schema: AnyZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      (req as any).body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Validates and replaces req.query with parsed result.
 */
export function validateQuery<T>(schema: AnyZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      (req as any).query = schema.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Validates and replaces req.params with parsed result.
 */
export function validateParams<T>(schema: AnyZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      (req as any).params = schema.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Safe integer parser for query/params/body (string or number -> integer).
 * This version avoids TS "type explosion" by not reassigning the schema type.
 *
 * Usage:
 * page: zInt({ min: 1, max: 100 }).default(1)
 */
export function zInt(opts?: { min?: number; max?: number }) {
  const base = z.preprocess(
    (v) => {
      if (typeof v === "string") {
        const t = v.trim();
        if (t === "") return undefined;
        return Number(t);
      }
      return v;
    },
    z.number({ invalid_type_error: "Must be a number" }),
  );

  // Build constraints without reassigning incompatible Zod types.
  return base
    .refine((n) => Number.isFinite(n), "Must be a number")
    .transform((n) => Math.trunc(n))
    .refine((n) => Number.isInteger(n), "Must be an integer")
    .refine(
      (n) => (opts?.min === undefined ? true : n >= opts.min),
      opts?.min !== undefined ? `Must be ≥ ${opts.min}` : "Invalid",
    )
    .refine(
      (n) => (opts?.max === undefined ? true : n <= opts.max),
      opts?.max !== undefined ? `Must be ≤ ${opts.max}` : "Invalid",
    );
}

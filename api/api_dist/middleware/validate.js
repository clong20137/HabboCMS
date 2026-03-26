"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
exports.zInt = zInt;
const zod_1 = require("zod");
/**
 * Validates and replaces req.body with parsed result.
 */
function validateBody(schema) {
    return (req, _res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**
 * Validates and replaces req.query with parsed result.
 */
function validateQuery(schema) {
    return (req, _res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**
 * Validates and replaces req.params with parsed result.
 */
function validateParams(schema) {
    return (req, _res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (err) {
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
function zInt(opts) {
    const base = zod_1.z.preprocess((v) => {
        if (typeof v === "string") {
            const t = v.trim();
            if (t === "")
                return undefined;
            return Number(t);
        }
        return v;
    }, zod_1.z.number({ invalid_type_error: "Must be a number" }));
    // Build constraints without reassigning incompatible Zod types.
    return base
        .refine((n) => Number.isFinite(n), "Must be a number")
        .transform((n) => Math.trunc(n))
        .refine((n) => Number.isInteger(n), "Must be an integer")
        .refine((n) => (opts?.min === undefined ? true : n >= opts.min), opts?.min !== undefined ? `Must be ≥ ${opts.min}` : "Invalid")
        .refine((n) => (opts?.max === undefined ? true : n <= opts.max), opts?.max !== undefined ? `Must be ≤ ${opts.max}` : "Invalid");
}

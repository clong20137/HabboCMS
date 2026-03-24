"use strict";
// Backwards-compatible barrel so imports like `import { pool } from "../db"` keep working.
// Source of truth is in ./db/*.
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = exports.pool = void 0;
var pool_1 = require("./db/pool");
Object.defineProperty(exports, "pool", { enumerable: true, get: function () { return pool_1.pool; } });
var transaction_1 = require("./db/transaction");
Object.defineProperty(exports, "withTransaction", { enumerable: true, get: function () { return transaction_1.withTransaction; } });

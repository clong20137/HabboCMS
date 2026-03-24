"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unauthorized = exports.notFound = exports.forbidden = exports.badRequest = exports.AppError = void 0;
// Compatibility layer for earlier code.
var ApiError_1 = require("./ApiError");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return ApiError_1.ApiError; } });
Object.defineProperty(exports, "badRequest", { enumerable: true, get: function () { return ApiError_1.badRequest; } });
Object.defineProperty(exports, "forbidden", { enumerable: true, get: function () { return ApiError_1.forbidden; } });
Object.defineProperty(exports, "notFound", { enumerable: true, get: function () { return ApiError_1.notFound; } });
Object.defineProperty(exports, "unauthorized", { enumerable: true, get: function () { return ApiError_1.unauthorized; } });

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.badRequest = badRequest;
exports.unauthorized = unauthorized;
exports.forbidden = forbidden;
exports.notFound = notFound;
class ApiError extends Error {
    constructor(status, message, opts) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = opts?.code;
        this.details = opts?.details;
    }
}
exports.ApiError = ApiError;
function badRequest(message, code, details) {
    return new ApiError(400, message, { code, details });
}
function unauthorized(message = "Unauthorized", code, details) {
    return new ApiError(401, message, { code, details });
}
function forbidden(message = "Forbidden", code, details) {
    return new ApiError(403, message, { code, details });
}
function notFound(message = "Not found", code, details) {
    return new ApiError(404, message, { code, details });
}

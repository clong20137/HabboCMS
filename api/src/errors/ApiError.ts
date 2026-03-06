export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(status: number, message: string, opts?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

export function badRequest(message: string, code?: string, details?: unknown) {
  return new ApiError(400, message, { code, details });
}

export function unauthorized(message = "Unauthorized", code?: string, details?: unknown) {
  return new ApiError(401, message, { code, details });
}

export function forbidden(message = "Forbidden", code?: string, details?: unknown) {
  return new ApiError(403, message, { code, details });
}

export function notFound(message = "Not found", code?: string, details?: unknown) {
  return new ApiError(404, message, { code, details });
}

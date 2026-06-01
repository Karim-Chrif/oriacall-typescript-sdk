import type { components } from "./generated/schema.js";

export type VueVoxErrorResponse = components["schemas"]["ErrorResponse"];

export class VueVoxApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly isRateLimited: boolean;
  readonly requestId?: string;
  readonly retryAfter?: number;
  readonly response?: VueVoxErrorResponse;

  constructor(
    status: number,
    code: string,
    message: string,
    response?: VueVoxErrorResponse,
    requestId?: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "VueVoxApiError";
    this.status = status;
    this.code = code;
    this.details = response?.error.details;
    this.isRateLimited = status === 429 || code === "rate_limited";
    this.requestId = requestId ?? response?.error.requestId;
    this.retryAfter = retryAfter;
    this.response = response;
  }
}

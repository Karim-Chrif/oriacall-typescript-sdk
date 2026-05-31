import type { components } from "./generated/schema.js";

export type VueVoxErrorResponse = components["schemas"]["ErrorResponse"];

export class VueVoxApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly response?: VueVoxErrorResponse;

  constructor(
    status: number,
    code: string,
    message: string,
    response?: VueVoxErrorResponse,
    requestId?: string,
  ) {
    super(message);
    this.name = "VueVoxApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId ?? response?.error.requestId;
    this.response = response;
  }
}

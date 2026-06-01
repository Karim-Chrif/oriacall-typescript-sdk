import createClient from "openapi-fetch";

import { VueVoxApiError } from "./errors.js";
import type { components, paths } from "./generated/schema.js";

type TokenResponse = components["schemas"]["TokenResponse"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
type HelloResponse = components["schemas"]["HelloResponse"];
type SpacesListResponse = components["schemas"]["SpacesListResponse"];
type CallsListResponse = components["schemas"]["CallsListResponse"];
type CallDetailResponse = components["schemas"]["CallDetailResponse"];
type LeadsListResponse = components["schemas"]["LeadsListResponse"];
type LeadDetailResponse = components["schemas"]["LeadDetailResponse"];
type Space = components["schemas"]["Space"];
type CallSummary = components["schemas"]["CallSummary"];
type Lead = components["schemas"]["Lead"];

export interface ListSpacesOptions {
  limit?: number;
  cursor?: string;
}

export interface ListCallsOptions extends ListSpacesOptions {
  spaceId?: string;
  leadId?: string;
  agentId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface ListLeadsOptions extends ListSpacesOptions {
  spaceId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface VueVoxResponseMetadata {
  requestId?: string;
  status: number;
}

export interface VueVoxApiResponse<T> extends VueVoxResponseMetadata {
  data: T;
}

export interface VueVoxResponseEvent extends VueVoxResponseMetadata {
  method: string;
  path: string;
  retryAfter?: number;
}

export interface VueVoxClientOptions {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  scope?: string | string[];
  fetch?: typeof fetch;
  onResponse?: (event: VueVoxResponseEvent) => void;
  retries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface JsonResult<T> {
  data: T;
  requestId?: string;
  response: Response;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
  };
}

type ListFunction<TItem, TOptions extends ListSpacesOptions> = (options?: TOptions) => Promise<VueVoxApiResponse<PaginatedResponse<TItem>>>;

export function createVueVoxClient(options: VueVoxClientOptions) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.vuevox.com");
  const fetchFn = options.fetch ?? fetch;
  const raw = createClient<paths>({ baseUrl, fetch: fetchFn });
  const retries = options.retries ?? 0;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
  const retryMaxDelayMs = options.retryMaxDelayMs ?? 2_000;
  let cachedToken: CachedToken | null = null;

  async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
      return cachedToken.accessToken;
    }

    const result = await requestJson<TokenResponse>("POST", "/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: options.clientId,
        client_secret: options.clientSecret,
        scope: formatScope(options.scope),
      }),
    });

    const body = result.data;

    cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };

    return cachedToken.accessToken;
  }

  async function getHello(): Promise<VueVoxApiResponse<HelloResponse>> {
    return apiGet<HelloResponse>("/v1/hello");
  }

  async function listSpaces(listOptions: ListSpacesOptions = {}): Promise<VueVoxApiResponse<SpacesListResponse>> {
    return apiGet<SpacesListResponse>("/v1/spaces", listOptions);
  }

  async function listCalls(listOptions: ListCallsOptions = {}): Promise<VueVoxApiResponse<CallsListResponse>> {
    return apiGet<CallsListResponse>("/v1/calls", listOptions);
  }

  async function getCall(callId: string): Promise<VueVoxApiResponse<CallDetailResponse>> {
    return apiGet<CallDetailResponse>(`/v1/calls/${encodeURIComponent(callId)}`);
  }

  async function listLeads(listOptions: ListLeadsOptions = {}): Promise<VueVoxApiResponse<LeadsListResponse>> {
    return apiGet<LeadsListResponse>("/v1/leads", listOptions);
  }

  async function getLead(leadId: string): Promise<VueVoxApiResponse<LeadDetailResponse>> {
    return apiGet<LeadDetailResponse>(`/v1/leads/${encodeURIComponent(leadId)}`);
  }

  async function apiGet<T>(path: string, query?: object): Promise<VueVoxApiResponse<T>> {
    const accessToken = await getAccessToken();
    const result = await requestJson<T>("GET", path, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      query,
    });

    return withMetadata(result.data, result.response, result.requestId);
  }

  async function requestJson<T>(method: string, path: string, init: RequestInit & { query?: object }): Promise<JsonResult<T>> {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchFn(buildUrl(baseUrl, path, init.query), init);
      const body = await parseJson<T | ErrorResponse>(response);
      const requestId = getRequestId(response, body);
      const retryAfter = retryAfterSeconds(response);
      notifyResponse(options, method, path, response, requestId, retryAfter);

      if (response.ok) {
        if (body === null || isErrorResponse(body)) {
          throw new VueVoxApiError(response.status, "invalid_response", "VueVox returned an invalid response.", undefined, requestId, retryAfter);
        }

        return { data: body as T, requestId, response };
      }

      if (attempt < retries && shouldRetry(response.status)) {
        await sleep(retryDelayMs(attempt, retryAfter));
        continue;
      }

      const error = isErrorResponse(body) ? body.error : null;
      throw new VueVoxApiError(
        response.status,
        error?.code ?? "api_request_failed",
        error?.message ?? "VueVox API request failed.",
        isErrorResponse(body) ? body : undefined,
        requestId,
        retryAfter,
      );
    }
  }

  function retryDelayMs(attempt: number, retryAfter: number | undefined): number {
    if (retryAfter !== undefined) {
      return retryAfter * 1000;
    }

    return Math.min(retryBaseDelayMs * 2 ** attempt, retryMaxDelayMs);
  }

  return {
    getAccessToken,
    hello: {
      get: getHello,
    },
    spaces: {
      list: listSpaces,
      paginate: (listOptions: ListSpacesOptions = {}) => paginate(listSpaces, listOptions),
    },
    calls: {
      list: listCalls,
      get: getCall,
      paginate: (listOptions: ListCallsOptions = {}) => paginate(listCalls, listOptions),
    },
    leads: {
      list: listLeads,
      get: getLead,
      paginate: (listOptions: ListLeadsOptions = {}) => paginate(listLeads, listOptions),
    },
    raw,
  };
}

function formatScope(scope: string | string[] | undefined): string | undefined {
  if (Array.isArray(scope)) {
    return scope.join(" ");
  }

  return scope;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query: object | undefined): string {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if ((typeof value === "string" || typeof value === "number") && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function isTokenResponse(value: unknown): value is TokenResponse {
  return isObject(value) && "access_token" in value;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return isObject(value) && "error" in value;
}

function getRequestId(response: Response, body?: unknown): string | undefined {
  return response.headers.get("X-Request-Id") ?? (isErrorBody(body) ? body.error.requestId : undefined);
}

function isErrorBody(value: unknown): value is ErrorResponse {
  return isObject(value) && "error" in value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function withMetadata<T>(data: T, response: Response, requestId: string | undefined): VueVoxApiResponse<T> {
  return {
    data,
    requestId,
    status: response.status,
  };
}

function notifyResponse(
  options: VueVoxClientOptions,
  method: string,
  path: string,
  response: Response,
  requestId: string | undefined,
  retryAfter?: number,
): void {
  options.onResponse?.({
    method,
    path,
    requestId,
    retryAfter,
    status: response.status,
  });
}

async function* paginate<TItem, TOptions extends ListSpacesOptions>(
  list: ListFunction<TItem, TOptions>,
  listOptions: TOptions,
): AsyncGenerator<TItem> {
  let cursor = listOptions.cursor;

  do {
    const response = await list({ ...listOptions, cursor });

    for (const item of response.data.data) {
      yield item;
    }

    cursor = response.data.pagination.nextCursor ?? undefined;
  } while (cursor);
}

function shouldRetry(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");

  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? undefined : Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { CallDetailResponse, CallsListResponse, CallSummary, HelloResponse, Lead, LeadDetailResponse, LeadsListResponse, Space, SpacesListResponse };

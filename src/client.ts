import createClient from "openapi-fetch";

import { OriacallApiError } from "./errors.js";
import type { components, paths } from "./generated/schema.js";

type TokenResponse = components["schemas"]["TokenResponse"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
export type HelloResponse = components["schemas"]["HelloResponse"];
export type ObjectivesListResponse = components["schemas"]["ObjectivesListResponse"];
export type ObjectiveResponse = components["schemas"]["ObjectiveResponse"];
export type ObjectiveUpdateRequest = components["schemas"]["ObjectiveUpdateRequest"];
export type AgentsListResponse = components["schemas"]["AgentsListResponse"];
export type CallsListResponse = components["schemas"]["CallsListResponse"];
export type CallDetailResponse = components["schemas"]["CallDetailResponse"];
export type CallResponse = components["schemas"]["CallResponse"];
export type CallUploadMetadata = components["schemas"]["CallUploadMetadata"];
export type LeadsListResponse = components["schemas"]["LeadsListResponse"];
export type LeadDetailResponse = components["schemas"]["LeadDetailResponse"];
export type LeadCustomFieldsListResponse = components["schemas"]["LeadCustomFieldsListResponse"];
export type LeadCustomFieldResponse = components["schemas"]["LeadCustomFieldResponse"];
export type LeadCustomFieldCreateRequest = components["schemas"]["LeadCustomFieldCreateRequest"];
export type LeadCustomFieldUpdateRequest = components["schemas"]["LeadCustomFieldUpdateRequest"];
export type ObjectiveCustomFieldsListResponse = components["schemas"]["ObjectiveCustomFieldsListResponse"];
export type ObjectiveCustomFieldResponse = components["schemas"]["ObjectiveCustomFieldResponse"];
export type ObjectiveCustomFieldCreateRequest = components["schemas"]["ObjectiveCustomFieldCreateRequest"];
export type ObjectiveCustomFieldUpdateRequest = components["schemas"]["ObjectiveCustomFieldUpdateRequest"];
export type WebhookEndpoint = components["schemas"]["WebhookEndpoint"];
export type WebhookEndpointCreateRequest = components["schemas"]["WebhookEndpointCreateRequest"];
export type WebhookEndpointUpdateRequest = components["schemas"]["WebhookEndpointUpdateRequest"];
export type WebhookEndpointResponse = components["schemas"]["WebhookEndpointResponse"];
export type WebhookEndpointSecretResponse = components["schemas"]["WebhookEndpointSecretResponse"];
export type WebhookEndpointsListResponse = components["schemas"]["WebhookEndpointsListResponse"];
export type WebhookTestResponse = components["schemas"]["WebhookTestResponse"];
export type WebhookEventPayload = components["schemas"]["WebhookEventPayload"];
export type LeadUpsertRequest = components["schemas"]["LeadUpsertRequest"];
export type LeadUpdateRequest = components["schemas"]["LeadUpdateRequest"];
export type Objective = components["schemas"]["Objective"];
export type Agent = components["schemas"]["Agent"];
export type CallSummary = components["schemas"]["CallSummary"];
export type CallAnalysis = components["schemas"]["CallAnalysis"];
export type AnalysisParam = components["schemas"]["AnalysisParam"];
export type Lead = components["schemas"]["Lead"];
export type LeadCustomField = components["schemas"]["LeadCustomField"];
export type ObjectiveCustomField = components["schemas"]["ObjectiveCustomField"];

export type CustomFieldFilterValue = string | number | boolean | { eq?: string | number | boolean; gt?: string | number; gte?: string | number; lt?: string | number; lte?: string | number; before?: string; after?: string; contains?: string };
export type CustomFieldFilters = Record<string, CustomFieldFilterValue>;

export interface ListObjectivesOptions {
  limit?: number;
  cursor?: string;
  objectiveCustomFields?: CustomFieldFilters;
}

export interface ListCallsOptions extends ListObjectivesOptions {
  objectiveId?: string;
  leadId?: string;
  agentId?: string;
  createdAfter?: string;
  createdBefore?: string;
  recordedAfter?: string;
  recordedBefore?: string;
  sortBy?: "createdAt" | "recordedAt";
  leadCustomFields?: CustomFieldFilters;
}

export interface UploadCallInput extends CallUploadMetadata {
  idempotencyKey: string;
  audio: {
    file: Blob | ArrayBuffer | Uint8Array;
    filename?: string;
    contentType?: string;
  };
}

export interface WaitForAnalysisOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export interface ListAgentsOptions extends ListObjectivesOptions {
  objectiveId?: string;
}

export interface ListLeadsOptions extends ListObjectivesOptions {
  objectiveId?: string;
  createdAfter?: string;
  createdBefore?: string;
  customFields?: CustomFieldFilters;
}

export interface ListLeadCustomFieldsOptions {
  includeArchived?: boolean;
}

export interface ListObjectiveCustomFieldsOptions {
  includeArchived?: boolean;
}

export interface ListWebhookEndpointsOptions extends ListObjectivesOptions {}

export interface VerifyWebhookSignatureInput {
  body: string;
  secret: string;
  signature: string;
  timestamp: string;
  toleranceSeconds?: number;
  now?: number;
}

export interface OriacallResponseMetadata {
  requestId?: string;
  status: number;
}

export interface OriacallApiResponse<T> extends OriacallResponseMetadata {
  data: T;
}

export interface OriacallResponseEvent extends OriacallResponseMetadata {
  method: string;
  path: string;
  retryAfter?: number;
}

export interface OriacallClientOptions {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  scope?: string | string[];
  fetch?: typeof fetch;
  onResponse?: (event: OriacallResponseEvent) => void;
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

type ListFunction<TItem, TOptions extends ListObjectivesOptions> = (options?: TOptions) => Promise<OriacallApiResponse<PaginatedResponse<TItem>>>;

export function createOriacallClient(options: OriacallClientOptions) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.oriacall.com");
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

  async function getHello(): Promise<OriacallApiResponse<HelloResponse>> {
    return apiGet<HelloResponse>("/v1/hello");
  }

  async function listObjectives(listOptions: ListObjectivesOptions = {}): Promise<OriacallApiResponse<ObjectivesListResponse>> {
    return apiGet<ObjectivesListResponse>("/v1/objectives", listOptions);
  }

  async function updateObjective(objectiveId: string, input: ObjectiveUpdateRequest): Promise<OriacallApiResponse<ObjectiveResponse>> {
    return apiJson<ObjectiveResponse>("PATCH", `/v1/objectives/${encodeURIComponent(objectiveId)}`, input);
  }

  async function listAgents(listOptions: ListAgentsOptions = {}): Promise<OriacallApiResponse<AgentsListResponse>> {
    return apiGet<AgentsListResponse>("/v1/agents", listOptions);
  }

  async function listCalls(listOptions: ListCallsOptions = {}): Promise<OriacallApiResponse<CallsListResponse>> {
    return apiGet<CallsListResponse>("/v1/calls", listOptions);
  }

  async function getCall(callId: string): Promise<OriacallApiResponse<CallDetailResponse>> {
    return apiGet<CallDetailResponse>(`/v1/calls/${encodeURIComponent(callId)}`);
  }

  async function uploadCall(input: UploadCallInput): Promise<OriacallApiResponse<CallResponse>> {
    const { audio, idempotencyKey, ...metadata } = input;
    const formData = new FormData();
    formData.set("metadata", JSON.stringify(metadata));
    formData.set("audioFile", toUploadBlob(audio.file, audio.contentType), audio.filename ?? "call-audio");

    return apiMultipart<CallResponse>("POST", "/v1/calls", formData, {
      "Idempotency-Key": idempotencyKey,
    });
  }

  async function queueCallAnalysis(callId: string): Promise<OriacallApiResponse<CallResponse>> {
    return apiJson<CallResponse>("POST", `/v1/calls/${encodeURIComponent(callId)}/analysis-jobs`, {});
  }

  async function waitForCallAnalysis(callId: string, waitOptions: WaitForAnalysisOptions = {}): Promise<OriacallApiResponse<CallDetailResponse>> {
    const intervalMs = waitOptions.intervalMs ?? 2_000;
    const timeoutMs = waitOptions.timeoutMs ?? 120_000;
    const startedAt = Date.now();

    for (;;) {
      const response = await getCall(callId);
      const status = response.data.data.analysisStatus;

      if (status === "completed" || status === "failed") {
        return response;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new OriacallApiError(408, "analysis_timeout", "Timed out waiting for call analysis.", undefined, response.requestId);
      }

      await sleep(intervalMs);
    }
  }

  async function listLeads(listOptions: ListLeadsOptions = {}): Promise<OriacallApiResponse<LeadsListResponse>> {
    return apiGet<LeadsListResponse>("/v1/leads", listOptions);
  }

  async function getLead(leadId: string): Promise<OriacallApiResponse<LeadDetailResponse>> {
    return apiGet<LeadDetailResponse>(`/v1/leads/${encodeURIComponent(leadId)}`);
  }

  async function updateLead(leadId: string, input: LeadUpdateRequest): Promise<OriacallApiResponse<LeadDetailResponse>> {
    return apiJson<LeadDetailResponse>("PATCH", `/v1/leads/${encodeURIComponent(leadId)}`, input);
  }

  async function upsertLeadByExternalId(externalId: string, input: LeadUpsertRequest): Promise<OriacallApiResponse<LeadDetailResponse>> {
    return apiJson<LeadDetailResponse>("PUT", `/v1/leads/by-external-id/${encodeURIComponent(externalId)}`, input);
  }

  async function listLeadCustomFields(listOptions: ListLeadCustomFieldsOptions = {}): Promise<OriacallApiResponse<LeadCustomFieldsListResponse>> {
    return apiGet<LeadCustomFieldsListResponse>("/v1/lead-custom-fields", listOptions);
  }

  async function createLeadCustomField(input: LeadCustomFieldCreateRequest): Promise<OriacallApiResponse<LeadCustomFieldResponse>> {
    return apiJson<LeadCustomFieldResponse>("POST", "/v1/lead-custom-fields", input);
  }

  async function updateLeadCustomField(key: string, input: LeadCustomFieldUpdateRequest): Promise<OriacallApiResponse<LeadCustomFieldResponse>> {
    return apiJson<LeadCustomFieldResponse>("PATCH", `/v1/lead-custom-fields/${encodeURIComponent(key)}`, input);
  }

  async function listObjectiveCustomFields(listOptions: ListObjectiveCustomFieldsOptions = {}): Promise<OriacallApiResponse<ObjectiveCustomFieldsListResponse>> {
    return apiGet<ObjectiveCustomFieldsListResponse>("/v1/objective-custom-fields", listOptions);
  }

  async function createObjectiveCustomField(input: ObjectiveCustomFieldCreateRequest): Promise<OriacallApiResponse<ObjectiveCustomFieldResponse>> {
    return apiJson<ObjectiveCustomFieldResponse>("POST", "/v1/objective-custom-fields", input);
  }

  async function updateObjectiveCustomField(key: string, input: ObjectiveCustomFieldUpdateRequest): Promise<OriacallApiResponse<ObjectiveCustomFieldResponse>> {
    return apiJson<ObjectiveCustomFieldResponse>("PATCH", `/v1/objective-custom-fields/${encodeURIComponent(key)}`, input);
  }

  async function listWebhookEndpoints(listOptions: ListWebhookEndpointsOptions = {}): Promise<OriacallApiResponse<WebhookEndpointsListResponse>> {
    return apiGet<WebhookEndpointsListResponse>("/v1/webhooks/endpoints", listOptions);
  }

  async function createWebhookEndpoint(input: WebhookEndpointCreateRequest): Promise<OriacallApiResponse<WebhookEndpointSecretResponse>> {
    return apiJson<WebhookEndpointSecretResponse>("POST", "/v1/webhooks/endpoints", input);
  }

  async function updateWebhookEndpoint(endpointId: string, input: WebhookEndpointUpdateRequest): Promise<OriacallApiResponse<WebhookEndpointResponse>> {
    return apiJson<WebhookEndpointResponse>("PATCH", `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`, input);
  }

  async function deleteWebhookEndpoint(endpointId: string): Promise<OriacallApiResponse<null>> {
    return apiDelete(`/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}`);
  }

  async function rotateWebhookEndpointSecret(endpointId: string): Promise<OriacallApiResponse<WebhookEndpointSecretResponse>> {
    return apiJson<WebhookEndpointSecretResponse>("POST", `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/rotate-secret`, {});
  }

  async function testWebhookEndpoint(endpointId: string): Promise<OriacallApiResponse<WebhookTestResponse>> {
    return apiJson<WebhookTestResponse>("POST", `/v1/webhooks/endpoints/${encodeURIComponent(endpointId)}/test`, {});
  }

  async function apiGet<T>(path: string, query?: object): Promise<OriacallApiResponse<T>> {
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

  async function apiJson<T>(method: "POST" | "PUT" | "PATCH", path: string, body: object): Promise<OriacallApiResponse<T>> {
    const accessToken = await getAccessToken();
    const result = await requestJson<T>(method, path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return withMetadata(result.data, result.response, result.requestId);
  }

  async function apiDelete(path: string): Promise<OriacallApiResponse<null>> {
    const accessToken = await getAccessToken();
    const response = await fetchFn(buildUrl(baseUrl, path, undefined), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = await parseJson<ErrorResponse>(response);
    const requestId = getRequestId(response, body);
    const retryAfter = retryAfterSeconds(response);
    notifyResponse(options, "DELETE", path, response, requestId, retryAfter);

    if (response.ok) {
      return withMetadata(null, response, requestId);
    }

    const error = isErrorResponse(body) ? body.error : null;
    throw new OriacallApiError(
      response.status,
      error?.code ?? "api_request_failed",
      error?.message ?? "Oriacall API request failed.",
      isErrorResponse(body) ? body : undefined,
      requestId,
      retryAfter,
    );
  }

  async function apiMultipart<T>(method: "POST", path: string, body: FormData, headers: Record<string, string>): Promise<OriacallApiResponse<T>> {
    const accessToken = await getAccessToken();
    const result = await requestJson<T>(method, path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...headers,
      },
      body,
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
          throw new OriacallApiError(response.status, "invalid_response", "Oriacall returned an invalid response.", undefined, requestId, retryAfter);
        }

        return { data: body as T, requestId, response };
      }

      if (attempt < retries && (method === "GET" || path === "/oauth/token") && shouldRetry(response.status)) {
        await sleep(retryDelayMs(attempt, retryAfter));
        continue;
      }

      const error = isErrorResponse(body) ? body.error : null;
      throw new OriacallApiError(
        response.status,
        error?.code ?? "api_request_failed",
        error?.message ?? "Oriacall API request failed.",
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
    objectives: {
      list: listObjectives,
      update: updateObjective,
      paginate: (listOptions: ListObjectivesOptions = {}) => paginate(listObjectives, listOptions),
    },
    agents: {
      list: listAgents,
      paginate: (listOptions: ListAgentsOptions = {}) => paginate(listAgents, listOptions),
    },
    calls: {
      list: listCalls,
      get: getCall,
      upload: uploadCall,
      queueAnalysis: queueCallAnalysis,
      waitForAnalysis: waitForCallAnalysis,
      paginate: (listOptions: ListCallsOptions = {}) => paginate(listCalls, listOptions),
    },
    leads: {
      list: listLeads,
      get: getLead,
      update: updateLead,
      upsertByExternalId: upsertLeadByExternalId,
      paginate: (listOptions: ListLeadsOptions = {}) => paginate(listLeads, listOptions),
    },
    leadCustomFields: {
      list: listLeadCustomFields,
      create: createLeadCustomField,
      update: updateLeadCustomField,
    },
    objectiveCustomFields: {
      list: listObjectiveCustomFields,
      create: createObjectiveCustomField,
      update: updateObjectiveCustomField,
    },
    webhooks: {
      endpoints: {
        list: listWebhookEndpoints,
        create: createWebhookEndpoint,
        update: updateWebhookEndpoint,
        delete: deleteWebhookEndpoint,
        rotateSecret: rotateWebhookEndpointSecret,
        test: testWebhookEndpoint,
        paginate: (listOptions: ListWebhookEndpointsOptions = {}) => paginate(listWebhookEndpoints, listOptions),
      },
    },
    raw,
  };
}

export async function verifyOriacallWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const now = input.now ?? Date.now();
  const timestampSeconds = Number(input.timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  if (Math.abs(Math.floor(now / 1000) - timestampSeconds) > toleranceSeconds) {
    return false;
  }

  const expected = await hmacSha256Hex(input.secret, `${input.timestamp}.${input.body}`);
  const provided = input.signature.startsWith("v1=") ? input.signature.slice(3) : input.signature;

  return constantTimeEqual(expected, provided);
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

  appendQueryParams(url.searchParams, query ?? {});

  return url.toString();
}

function appendQueryParams(searchParams: URLSearchParams, query: object, prefix?: string): void {
  for (const [rawKey, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const key = queryKey(rawKey, prefix);

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      searchParams.set(key, String(value));
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      appendQueryParams(searchParams, value, key);
    }
  }
}

function queryKey(key: string, prefix?: string): string {
  const publicKey = key === "customFields" ? "custom" : key === "leadCustomFields" ? "leadCustom" : key === "objectiveCustomFields" ? "objectiveCustom" : key;

  return prefix ? `${prefix}[${publicKey}]` : publicKey;
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

function withMetadata<T>(data: T, response: Response, requestId: string | undefined): OriacallApiResponse<T> {
  return {
    data,
    requestId,
    status: response.status,
  };
}

function toUploadBlob(file: Blob | ArrayBuffer | Uint8Array, contentType?: string): Blob {
  if (file instanceof Blob) {
    return contentType && file.type !== contentType ? new Blob([file], { type: contentType }) : file;
  }

  return new Blob([file as BlobPart], { type: contentType });
}

function notifyResponse(
  options: OriacallClientOptions,
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

async function* paginate<TItem, TOptions extends ListObjectivesOptions>(
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

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

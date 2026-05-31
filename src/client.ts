import createClient from "openapi-fetch";

import { VueVoxApiError } from "./errors.js";
import type { components, paths } from "./generated/schema.js";

type TokenResponse = components["schemas"]["TokenResponse"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
type HelloResponse = components["schemas"]["HelloResponse"];
type SpacesListResponse = components["schemas"]["SpacesListResponse"];

export interface ListSpacesOptions {
  limit?: number;
  cursor?: string;
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
}

export interface VueVoxClientOptions {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  scope?: string | string[];
  fetch?: typeof fetch;
  onResponse?: (event: VueVoxResponseEvent) => void;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export function createVueVoxClient(options: VueVoxClientOptions) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.vuevox.com");
  const fetchFn = options.fetch ?? fetch;
  const raw = createClient<paths>({ baseUrl, fetch: fetchFn });
  let cachedToken: CachedToken | null = null;

  async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
      return cachedToken.accessToken;
    }

    const response = await fetchFn(`${baseUrl}/oauth/token`, {
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

    const body = await parseJson<TokenResponse | ErrorResponse>(response);
    const requestId = getRequestId(response, body);
    notifyResponse(options, "POST", "/oauth/token", response, requestId);

    if (!response.ok) {
      const error = isErrorResponse(body) ? body.error : null;

      throw new VueVoxApiError(
        response.status,
        error?.code ?? "token_request_failed",
        error?.message ?? "VueVox token request failed.",
        isErrorResponse(body) ? body : undefined,
        requestId,
      );
    }

    if (!isTokenResponse(body)) {
      throw new VueVoxApiError(
        response.status,
        "invalid_token_response",
        "VueVox returned an invalid token response.",
        undefined,
        requestId,
      );
    }

    cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };

    return cachedToken.accessToken;
  }

  async function hello(): Promise<VueVoxApiResponse<HelloResponse>> {
    const accessToken = await getAccessToken();
    const { data, error, response } = await raw.GET("/v1/hello", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const requestId = getRequestId(response, error);
    notifyResponse(options, "GET", "/v1/hello", response, requestId);

    if (error) {
      throw new VueVoxApiError(
        response.status,
        error.error.code,
        error.error.message,
        error,
        requestId,
      );
    }

    return withMetadata(data, response, requestId);
  }

  async function listSpaces(listOptions: ListSpacesOptions = {}): Promise<VueVoxApiResponse<SpacesListResponse>> {
    const accessToken = await getAccessToken();
    const { data, error, response } = await raw.GET("/v1/spaces", {
      params: {
        query: listOptions,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const requestId = getRequestId(response, error);
    notifyResponse(options, "GET", "/v1/spaces", response, requestId);

    if (error) {
      throw new VueVoxApiError(
        response.status,
        error.error.code,
        error.error.message,
        error,
        requestId,
      );
    }

    return withMetadata(data, response, requestId);
  }

  return {
    getAccessToken,
    hello,
    listSpaces,
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

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function isTokenResponse(value: TokenResponse | ErrorResponse | null): value is TokenResponse {
  return Boolean(value && "access_token" in value);
}

function isErrorResponse(value: TokenResponse | ErrorResponse | null): value is ErrorResponse {
  return Boolean(value && "error" in value);
}

function getRequestId(response: Response, body?: ErrorResponse | TokenResponse | null): string | undefined {
  return response.headers.get("X-Request-Id") ?? (isErrorBody(body) ? body.error.requestId : undefined);
}

function isErrorBody(value: ErrorResponse | TokenResponse | null | undefined): value is ErrorResponse {
  return Boolean(value && "error" in value);
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
): void {
  options.onResponse?.({
    method,
    path,
    requestId,
    status: response.status,
  });
}

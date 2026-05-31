import createClient from "openapi-fetch";

import { VueVoxApiError } from "./errors.js";
import type { components, paths } from "./generated/schema.js";

type TokenResponse = components["schemas"]["TokenResponse"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
type HelloResponse = components["schemas"]["HelloResponse"];

export interface VueVoxClientOptions {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  scope?: string | string[];
  fetch?: typeof fetch;
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

    if (!response.ok) {
      const error = isErrorResponse(body) ? body.error : null;

      throw new VueVoxApiError(
        response.status,
        error?.code ?? "token_request_failed",
        error?.message ?? "VueVox token request failed.",
        isErrorResponse(body) ? body : undefined,
      );
    }

    if (!isTokenResponse(body)) {
      throw new VueVoxApiError(response.status, "invalid_token_response", "VueVox returned an invalid token response.");
    }

    cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };

    return cachedToken.accessToken;
  }

  async function hello(): Promise<HelloResponse> {
    const accessToken = await getAccessToken();
    const { data, error, response } = await raw.GET("/v1/hello", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      throw new VueVoxApiError(
        response.status,
        error.error.code,
        error.error.message,
        error,
      );
    }

    return data;
  }

  return {
    getAccessToken,
    hello,
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

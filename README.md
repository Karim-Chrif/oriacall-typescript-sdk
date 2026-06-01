# @vuevox/sdk

TypeScript SDK for the VueVox Developer API.

## Install

```bash
npm install @vuevox/sdk
```

## Create API Credentials

In VueVox, open:

```text
Settings -> Developer API -> Manage API Clients
```

Create a client, select the scopes it can request, and copy the `client_secret` immediately. VueVox shows each client secret only once.

Available scopes:

```text
hello:read
spaces:read
calls:read
leads:read
```

## Basic Usage

```ts
import { createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["hello:read", "spaces:read", "calls:read", "leads:read"],
});

const hello = await vuevox.hello.get();
console.log(hello.data.message, hello.requestId);

const spaces = await vuevox.spaces.list({ limit: 50 });
console.log(spaces.data.data, spaces.requestId);

const calls = await vuevox.calls.list({ limit: 50 });
console.log(calls.data.data, calls.requestId);

const leads = await vuevox.leads.list({ limit: 50 });
console.log(leads.data.data, leads.requestId);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Request IDs

Every Developer API response includes an `X-Request-Id` header. SDK endpoint methods return response metadata with the response body so you can log that ID for support requests.

```ts
const call = await vuevox.calls.get("call-id");

console.log(call.requestId);
console.log(call.data.data.transcript);
```

For centralized logging, pass `onResponse`. The hook runs for every SDK-managed HTTP response, including the token request.

```ts
const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["calls:read"],
  onResponse: ({ method, path, status, requestId }) => {
    console.log({ method, path, status, requestId });
  },
});
```

## Error Handling

API errors throw `VueVoxApiError`. The SDK exposes `error.requestId`, `error.details`, `error.retryAfter`, and `error.isRateLimited`.

```ts
import { VueVoxApiError, createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["calls:read"],
});

try {
  await vuevox.calls.list({ limit: 50 });
} catch (error) {
  if (error instanceof VueVoxApiError) {
    console.error(error.status, error.code, error.message, error.requestId);
  }

  throw error;
}
```

Common API error codes:

```text
missing_token
invalid_token
invalid_client
invalid_scope
insufficient_scope
rate_limited
invalid_request
call_not_found
lead_not_found
```

## Pagination

List endpoints use cursor pagination.

```ts
const firstPage = await vuevox.calls.list({ limit: 50 });

if (firstPage.data.pagination.nextCursor) {
  const secondPage = await vuevox.calls.list({
    limit: 50,
    cursor: firstPage.data.pagination.nextCursor,
  });
}
```

The SDK also includes async iterable helpers:

```ts
for await (const call of vuevox.calls.paginate({ limit: 50 })) {
  console.log(call.id);
}
```

Pagination helpers are available for `spaces`, `calls`, and `leads`.

## Retries

Configure retry/backoff for safe SDK-managed requests. The SDK retries token requests and GET endpoints for `429`, `500`, `502`, `503`, and `504`, and respects `Retry-After` when present.

```ts
const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["calls:read"],
  retries: 2,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 2000,
});
```

## Token Behavior

The SDK:

- Requests tokens using client credentials.
- Caches the access token in memory.
- Refreshes the token before expiry.
- Never stores credentials or tokens on disk.

## Base URL

The SDK defaults to:

```text
https://api.vuevox.com
```

If VueVox support gives you a custom API base URL, pass it explicitly:

```ts
const vuevox = createVueVoxClient({
  baseUrl: "https://api.vuevox.com",
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["calls:read"],
});
```

## Lower-Level Calls

For advanced integrations, `raw` exposes a typed lower-level API client.

```ts
const { data, error } = await vuevox.raw.GET("/v1/hello", {
  headers: {
    Authorization: `Bearer ${await vuevox.getAccessToken()}`,
  },
});
```

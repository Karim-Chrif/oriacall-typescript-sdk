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
```

## Basic Usage

```ts
import { createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["hello:read", "spaces:read"],
});

const hello = await vuevox.hello();
console.log(hello.data.message);
console.log(hello.requestId);

const spaces = await vuevox.listSpaces({ limit: 50 });
console.log(spaces.data.data);
console.log(spaces.requestId);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Request IDs

Every Developer API response includes an `X-Request-Id` header. SDK endpoint methods return response metadata with the response body so you can log that ID for support requests.

```ts
const spaces = await vuevox.listSpaces({ limit: 50 });

console.log(spaces.requestId);
console.log(spaces.data.data);
```

For centralized logging, pass `onResponse`. The hook runs for every SDK-managed HTTP response, including the token request.

```ts
const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["hello:read", "spaces:read"],
  onResponse: ({ method, path, status, requestId }) => {
    console.log({ method, path, status, requestId });
  },
});
```

## Error Handling

API errors throw `VueVoxApiError`. The SDK exposes `error.requestId` from either the response header or error body.

```ts
import { VueVoxApiError, createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["hello:read", "spaces:read"],
});

try {
  await vuevox.listSpaces({ limit: 50 });
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
  scope: ["hello:read", "spaces:read"],
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

## Pagination

List endpoints use cursor pagination.

```ts
const firstPage = await vuevox.listSpaces({ limit: 50 });

if (firstPage.data.pagination.nextCursor) {
  const secondPage = await vuevox.listSpaces({
    limit: 50,
    cursor: firstPage.data.pagination.nextCursor,
  });
}
```

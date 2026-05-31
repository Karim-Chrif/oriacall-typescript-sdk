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

Available scope:

```text
hello:read
```

## Basic Usage

```ts
import { createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: "hello:read",
});

const hello = await vuevox.hello();
console.log(hello.message);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Error Handling

API errors throw `VueVoxApiError`.

```ts
import { VueVoxApiError, createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: "hello:read",
});

try {
  await vuevox.hello();
} catch (error) {
  if (error instanceof VueVoxApiError) {
    console.error(error.status, error.code, error.message);
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
  scope: "hello:read",
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

# @vuevox/sdk

TypeScript SDK for the VueVox Developer API.

## Install

```bash
npm install @vuevox/sdk
```

Requirements:

- Node.js 18 or newer.
- A VueVox Developer API client ID and secret.
- Server-side usage only. Do not expose `clientSecret` in browser code.

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
agents:read
calls:read
leads:read
```

The token request can only request scopes that were granted to that API client.

## Quickstart

```ts
import { createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["hello:read", "spaces:read", "agents:read", "calls:read", "leads:read"],
});

const hello = await vuevox.hello.get();
console.log(hello.data.message, hello.requestId);

const calls = await vuevox.calls.list({ limit: 50 });
console.log(calls.data.data, calls.requestId);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Client Reference

### `createVueVoxClient(options)`

Creates a VueVox API client.

```ts
const vuevox = createVueVoxClient({
  baseUrl: "https://api.vuevox.com",
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: ["calls:read"],
  retries: 2,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 2000,
  onResponse: ({ method, path, status, requestId }) => {
    console.log({ method, path, status, requestId });
  },
});
```

Options:

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `clientId` | `string` | Yes | Developer API client ID. |
| `clientSecret` | `string` | Yes | Developer API client secret. Keep this server-side. |
| `baseUrl` | `string` | No | API base URL. Defaults to `https://api.vuevox.com`. |
| `scope` | `string \| string[]` | No | Space-separated string or array of requested token scopes. If omitted, the token request uses all scopes granted to the client. |
| `fetch` | `typeof fetch` | No | Custom fetch implementation. Defaults to global `fetch`. |
| `onResponse` | `(event: VueVoxResponseEvent) => void` | No | Called for every SDK-managed HTTP response, including token requests. |
| `retries` | `number` | No | Retry count for token requests and GET endpoints. Defaults to `0`. |
| `retryBaseDelayMs` | `number` | No | Initial retry delay. Defaults to `250`. |
| `retryMaxDelayMs` | `number` | No | Maximum retry delay. Defaults to `2000`. |

Returns a namespaced client:

```ts
vuevox.getAccessToken();
vuevox.hello.get();
vuevox.spaces.list();
vuevox.spaces.paginate();
vuevox.agents.list();
vuevox.agents.paginate();
vuevox.calls.list();
vuevox.calls.get("call-id");
vuevox.calls.paginate();
vuevox.leads.list();
vuevox.leads.get("lead-id");
vuevox.leads.paginate();
vuevox.raw.GET("/v1/hello", { headers: { Authorization: `Bearer ${await vuevox.getAccessToken()}` } });
```

## Response Envelope

All SDK endpoint methods return a response envelope:

```ts
type VueVoxApiResponse<T> = {
  data: T;
  status: number;
  requestId?: string;
};
```

Use `requestId` in logs and support requests. It maps to the API `X-Request-Id` response header.

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

List option fields shared by paginated endpoints:

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of items to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response's `pagination.nextCursor`. |

The SDK also includes async iterable helpers:

```ts
for await (const call of vuevox.calls.paginate({ limit: 50 })) {
  console.log(call.id);
}
```

Pagination helpers are available for `spaces`, `agents`, `calls`, and `leads`.

## Methods

### `vuevox.getAccessToken()`

Requests or returns a cached bearer token.

```ts
const token = await vuevox.getAccessToken();
```

Returns: `Promise<string>`.

### `vuevox.hello.get()`

Checks credentials and connectivity.

Required scope: `hello:read`.

```ts
const response = await vuevox.hello.get();
console.log(response.data.message);
```

Returns: `Promise<VueVoxApiResponse<HelloResponse>>`.

### `vuevox.spaces.list(options?)`

Lists organization spaces.

Required scope: `spaces:read`.

Options: `ListSpacesOptions`

```ts
const response = await vuevox.spaces.list({ limit: 50 });

for (const space of response.data.data) {
  console.log(space.id, space.name);
}
```

Returns: `Promise<VueVoxApiResponse<SpacesListResponse>>`.

### `vuevox.spaces.paginate(options?)`

Iterates organization spaces across all pages.

Required scope: `spaces:read`.

Options: `ListSpacesOptions`

```ts
for await (const space of vuevox.spaces.paginate({ limit: 100 })) {
  console.log(space.id, space.name);
}
```

Returns: `AsyncGenerator<Space>`.

### `vuevox.agents.list(options?)`

Lists organization agents.

Agent records include nullable `externalId` when you store an ID from another system.

Required scope: `agents:read`.

Options: `ListAgentsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of agents to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `spaceId` | `string` | Optional space ID filter. |

```ts
const response = await vuevox.agents.list({ limit: 50, spaceId: "space-id" });

for (const agent of response.data.data) {
  console.log(agent.id, agent.externalId, agent.name);
}
```

Returns: `Promise<VueVoxApiResponse<AgentsListResponse>>`.

### `vuevox.agents.paginate(options?)`

Iterates organization agents across all pages.

Required scope: `agents:read`.

Options: `ListAgentsOptions`

```ts
for await (const agent of vuevox.agents.paginate({ spaceId: "space-id" })) {
  console.log(agent.id, agent.externalId, agent.name);
}
```

Returns: `AsyncGenerator<Agent>`.

### `vuevox.calls.list(options?)`

Lists organization calls. List responses do not include transcripts.

Required scope: `calls:read`.

Options: `ListCallsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of calls to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `spaceId` | `string` | Optional space ID filter. |
| `leadId` | `string` | Optional lead ID filter. |
| `agentId` | `string` | Optional agent ID filter. |
| `createdAfter` | `string` | Optional ISO 8601 lower bound for call creation time. |
| `createdBefore` | `string` | Optional ISO 8601 upper bound for call creation time. |

```ts
const response = await vuevox.calls.list({
  limit: 50,
  spaceId: "space-id",
  createdAfter: "2026-01-01T00:00:00.000Z",
});

for (const call of response.data.data) {
  console.log(call.id, call.status, call.createdAt);
}
```

Returns: `Promise<VueVoxApiResponse<CallsListResponse>>`.

### `vuevox.calls.get(callId)`

Gets a call detail record, including transcript data when available.

Required scope: `calls:read`.

```ts
const response = await vuevox.calls.get("call-id");
console.log(response.data.data.transcript);
```

Returns: `Promise<VueVoxApiResponse<CallDetailResponse>>`.

### `vuevox.calls.paginate(options?)`

Iterates organization calls across all pages.

Required scope: `calls:read`.

Options: `ListCallsOptions`

```ts
for await (const call of vuevox.calls.paginate({ leadId: "lead-id" })) {
  console.log(call.id);
}
```

Returns: `AsyncGenerator<CallSummary>`.

### `vuevox.leads.list(options?)`

Lists organization leads. The `leads:read` scope includes lead email and phone contact details.

Lead records include nullable `externalId` when you store an ID from another system.

Required scope: `leads:read`.

Options: `ListLeadsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of leads to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `spaceId` | `string` | Optional space ID filter. |
| `createdAfter` | `string` | Optional ISO 8601 lower bound for lead creation time. |
| `createdBefore` | `string` | Optional ISO 8601 upper bound for lead creation time. |

```ts
const response = await vuevox.leads.list({ limit: 50, spaceId: "space-id" });

for (const lead of response.data.data) {
  console.log(lead.id, lead.externalId, lead.email, lead.phone);
}
```

Returns: `Promise<VueVoxApiResponse<LeadsListResponse>>`.

### `vuevox.leads.get(leadId)`

Gets a lead detail record, including email and phone contact details.

Required scope: `leads:read`.

```ts
const response = await vuevox.leads.get("lead-id");
console.log(response.data.externalId, response.data.email, response.data.phone);
```

Returns: `Promise<VueVoxApiResponse<LeadDetailResponse>>`.

### `vuevox.leads.paginate(options?)`

Iterates organization leads across all pages.

Required scope: `leads:read`.

Options: `ListLeadsOptions`

```ts
for await (const lead of vuevox.leads.paginate({ createdAfter: "2026-01-01T00:00:00.000Z" })) {
  console.log(lead.id, lead.externalId);
}
```

Returns: `AsyncGenerator<Lead>`.

## Lower-Level Calls

For advanced integrations, `raw` exposes a typed lower-level OpenAPI client. You must attach authorization yourself.

```ts
const { data, error } = await vuevox.raw.GET("/v1/hello", {
  headers: {
    Authorization: `Bearer ${await vuevox.getAccessToken()}`,
  },
});
```

## Errors

API errors throw `VueVoxApiError`.

```ts
import { VueVoxApiError, createVueVoxClient } from "@vuevox/sdk";

try {
  await vuevox.calls.list({ limit: 50 });
} catch (error) {
  if (error instanceof VueVoxApiError) {
    console.error(error.status, error.code, error.message, error.requestId);
  }

  throw error;
}
```

Error fields:

| Field | Type | Description |
| --- | --- | --- |
| `status` | `number` | HTTP status code. |
| `code` | `string` | Stable API error code. |
| `message` | `string` | Human-readable message. |
| `requestId` | `string \| undefined` | Request ID from `X-Request-Id` or error body. |
| `details` | `Record<string, unknown> \| undefined` | Structured error details when present. |
| `retryAfter` | `number \| undefined` | Seconds to wait before retrying when present. |
| `isRateLimited` | `boolean` | `true` for rate limit errors. |
| `response` | `VueVoxErrorResponse \| undefined` | Full API error response when available. |

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

## Exported Types

The package exports these TypeScript types:

```ts
import type {
  Agent,
  AgentsListResponse,
  CallDetailResponse,
  CallsListResponse,
  CallSummary,
  HelloResponse,
  Lead,
  LeadDetailResponse,
  LeadsListResponse,
  ListAgentsOptions,
  ListCallsOptions,
  ListLeadsOptions,
  ListSpacesOptions,
  Space,
  SpacesListResponse,
  VueVoxApiResponse,
  VueVoxClientOptions,
  VueVoxErrorResponse,
  VueVoxResponseEvent,
  VueVoxResponseMetadata,
} from "@vuevox/sdk";
```

Generated OpenAPI-derived types are included in the package declaration files, so editors can inspect the exact response fields for each method.

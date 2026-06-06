# @oriacall/sdk

TypeScript SDK for the Oriacall Developer API.

## Install

```bash
npm install @oriacall/sdk
```

Requirements:

- Node.js 18 or newer.
- An Oriacall Developer API client ID and secret.
- Server-side usage only. Do not expose `clientSecret` in browser code.

## Create API Credentials

In Oriacall, open:

```text
Settings -> Developer API -> Manage API Clients
```

Create a client, select the scopes it can request, and copy the `client_secret` immediately. Oriacall shows each client secret only once.

Available scopes:

```text
hello:read
objectives:read
objectives:write
objective_custom_fields:manage
agents:read
calls:read
calls:write
leads:read
leads:write
lead_custom_fields:manage
webhooks:read
webhooks:write
```

The token request can only request scopes that were granted to that API client.

## Quickstart

```ts
import { createOriacallClient } from "@oriacall/sdk";

const oriacall = createOriacallClient({
  clientId: process.env.ORIACALL_CLIENT_ID!,
  clientSecret: process.env.ORIACALL_CLIENT_SECRET!,
  scope: ["hello:read", "objectives:read", "agents:read", "calls:read", "leads:read"],
});

const hello = await oriacall.hello.get();
console.log(hello.data.message, hello.requestId);

const calls = await oriacall.calls.list({ limit: 50 });
console.log(calls.data.data, calls.requestId);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Client Reference

### `createOriacallClient(options)`

Creates an Oriacall API client.

```ts
const oriacall = createOriacallClient({
  baseUrl: "https://api.oriacall.com",
  clientId: process.env.ORIACALL_CLIENT_ID!,
  clientSecret: process.env.ORIACALL_CLIENT_SECRET!,
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
| `baseUrl` | `string` | No | API base URL. Defaults to `https://api.oriacall.com`. |
| `scope` | `string \| string[]` | No | Space-separated string or array of requested token scopes. If omitted, the token request uses all scopes granted to the client. |
| `fetch` | `typeof fetch` | No | Custom fetch implementation. Defaults to global `fetch`. |
| `onResponse` | `(event: OriacallResponseEvent) => void` | No | Called for every SDK-managed HTTP response, including token requests. |
| `retries` | `number` | No | Retry count for token requests and GET endpoints. Defaults to `0`. |
| `retryBaseDelayMs` | `number` | No | Initial retry delay. Defaults to `250`. |
| `retryMaxDelayMs` | `number` | No | Maximum retry delay. Defaults to `2000`. |

Returns a namespaced client:

```ts
oriacall.getAccessToken();
oriacall.hello.get();
oriacall.objectives.list();
oriacall.objectives.update("objective-id", { customFields: { region: "north" } });
oriacall.objectives.paginate();
oriacall.objectiveCustomFields.list();
oriacall.objectiveCustomFields.create({ key: "region", label: "Region", type: "select", options: ["north", "south"] });
oriacall.objectiveCustomFields.update("region", { label: "Sales Region" });
oriacall.agents.list();
oriacall.agents.paginate();
oriacall.calls.list();
oriacall.calls.get("call-id");
oriacall.calls.upload({ idempotencyKey: "crm-call-123", agent: { externalId: "agent-1", name: "Morgan" }, lead: { externalId: "lead-1", firstName: "Ada", lastName: "Lovelace" }, audio: { file: audioBlob, filename: "call.mp3" } });
oriacall.calls.queueAnalysis("call-id");
oriacall.calls.waitForAnalysis("call-id");
oriacall.calls.paginate();
oriacall.leads.list();
oriacall.leads.get("lead-id");
oriacall.leads.update("lead-id", { customFields: { crm_stage: "qualified" } });
oriacall.leads.upsertByExternalId("crm-lead-id", { firstName: "Ada", lastName: "Lovelace" });
oriacall.leads.paginate();
oriacall.leadCustomFields.list();
oriacall.leadCustomFields.create({ key: "crm_stage", label: "CRM Stage", type: "select", options: ["new", "qualified"] });
oriacall.leadCustomFields.update("crm_stage", { label: "CRM Stage" });
oriacall.webhooks.endpoints.list();
oriacall.webhooks.endpoints.create({ url: "https://example.com/oriacall/webhooks", events: ["analysis.completed", "analysis.failed"] });
oriacall.webhooks.endpoints.update("endpoint-id", { isActive: false });
oriacall.webhooks.endpoints.rotateSecret("endpoint-id");
oriacall.webhooks.endpoints.test("endpoint-id");
oriacall.webhooks.endpoints.delete("endpoint-id");
oriacall.raw.GET("/v1/hello", { headers: { Authorization: `Bearer ${await oriacall.getAccessToken()}` } });
```

## Response Envelope

All SDK endpoint methods return a response envelope:

```ts
type OriacallApiResponse<T> = {
  data: T;
  status: number;
  requestId?: string;
};
```

Use `requestId` in logs and support requests. It maps to the API `X-Request-Id` response header.

## Pagination

List endpoints use cursor pagination.

```ts
const firstPage = await oriacall.calls.list({ limit: 50 });

if (firstPage.data.pagination.nextCursor) {
  const secondPage = await oriacall.calls.list({
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
for await (const call of oriacall.calls.paginate({ limit: 50 })) {
  console.log(call.id);
}
```

Pagination helpers are available for `objectives`, `agents`, `calls`, `leads`, and `webhooks.endpoints`.

## Methods

### `oriacall.getAccessToken()`

Requests or returns a cached bearer token.

```ts
const token = await oriacall.getAccessToken();
```

Returns: `Promise<string>`.

### `oriacall.hello.get()`

Checks credentials and connectivity.

Required scope: `hello:read`.

```ts
const response = await oriacall.hello.get();
console.log(response.data.message);
```

Returns: `Promise<OriacallApiResponse<HelloResponse>>`.

### `oriacall.objectives.list(options?)`

Lists organization objectives.

Objective records include `customFields`, an object keyed by organization-defined objective custom field keys.

Required scope: `objectives:read`.

Options: `ListObjectivesOptions`

```ts
const response = await oriacall.objectives.list({ limit: 50 });

for (const objective of response.data.data) {
  console.log(objective.id, objective.name);
}
```

Returns: `Promise<OriacallApiResponse<ObjectivesListResponse>>`.

Options include `limit`, `cursor`, and `objectiveCustomFields` filters. `objectiveCustomFields` maps to the API's `objectiveCustom[...]` query parameters.

```ts
await oriacall.objectives.list({
  objectiveCustomFields: {
    region: "north",
    priority: { gte: 5 },
  },
});
```

### `oriacall.objectives.update(objectiveId, input)`

Updates custom field values for an objective. Send `null` to clear a field.

Required scope: `objectives:write`.

Input: `ObjectiveUpdateRequest`

```ts
const response = await oriacall.objectives.update("objective-id", {
  customFields: {
    region: "north",
    priority: 10,
  },
});

console.log(response.data.data.customFields);
```

Returns: `Promise<OriacallApiResponse<ObjectiveResponse>>`.

### `oriacall.objectives.paginate(options?)`

Iterates organization objectives across all pages.

Required scope: `objectives:read`.

Options: `ListObjectivesOptions`

```ts
for await (const objective of oriacall.objectives.paginate({ limit: 100 })) {
  console.log(objective.id, objective.name);
}
```

Returns: `AsyncGenerator<Objective>`.

### `oriacall.agents.list(options?)`

Lists organization agents.

Agent records include nullable `externalId` when you store an ID from another system.

Required scope: `agents:read`.

Options: `ListAgentsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of agents to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `objectiveId` | `string` | Optional objective ID filter. |

```ts
const response = await oriacall.agents.list({ limit: 50, objectiveId: "objective-id" });

for (const agent of response.data.data) {
  console.log(agent.id, agent.externalId, agent.name);
}
```

Returns: `Promise<OriacallApiResponse<AgentsListResponse>>`.

### `oriacall.agents.paginate(options?)`

Iterates organization agents across all pages.

Required scope: `agents:read`.

Options: `ListAgentsOptions`

```ts
for await (const agent of oriacall.agents.paginate({ objectiveId: "objective-id" })) {
  console.log(agent.id, agent.externalId, agent.name);
}
```

Returns: `AsyncGenerator<Agent>`.

### `oriacall.calls.list(options?)`

Lists organization calls. List responses do not include transcripts.

Required scope: `calls:read`.

Options: `ListCallsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of calls to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `objectiveId` | `string` | Optional objective ID filter. |
| `leadId` | `string` | Optional lead ID filter. |
| `agentId` | `string` | Optional agent ID filter. |
| `createdAfter` | `string` | Optional ISO 8601 lower bound for call creation time. |
| `createdBefore` | `string` | Optional ISO 8601 upper bound for call creation time. |
| `leadCustomFields` | `Record<string, CustomFieldFilterValue>` | Optional filters on lead custom fields attached to calls. |

```ts
const response = await oriacall.calls.list({
  limit: 50,
  objectiveId: "objective-id",
  createdAfter: "2026-01-01T00:00:00.000Z",
  leadCustomFields: {
    crm_stage: "qualified",
  },
});

for (const call of response.data.data) {
  console.log(call.id, call.status, call.createdAt);
}
```

Returns: `Promise<OriacallApiResponse<CallsListResponse>>`.

### `oriacall.calls.get(callId)`

Gets a call detail record, including transcript data when available.

Required scope: `calls:read`.

```ts
const response = await oriacall.calls.get("call-id");
console.log(response.data.data.transcript);
console.log(response.data.data.objectiveSelectionSource);
console.log(response.data.data.analysis?.organizationDetectedTags);
```

Returns: `Promise<OriacallApiResponse<CallDetailResponse>>`.

### `oriacall.calls.upload(input)`

Uploads an audio recording, upserts the agent and lead by `externalId`, creates the call, and optionally queues analysis.

Required scope: `calls:write`.

The API requires an idempotency key for uploads. Reusing the same `idempotencyKey` with the same request returns the original response; reusing it with different metadata or audio returns an `idempotency_key_conflict` error.

`objectiveId` is optional. When provided, Oriacall treats it as a hint for objective identification. The audio pass may override it; if no objective can be identified confidently, Oriacall uses the organization's superadmin-configured fallback objective.

The maximum audio upload size is configured by an Oriacall superadmin and defaults to 20 MB. Your server/proxy upload limits must also allow that size.

Options: `UploadCallInput`

| Option | Type | Description |
| --- | --- | --- |
| `idempotencyKey` | `string` | Required unique key for safe retries. |
| `objectiveId` | `string \| null` | Optional objective hint. Oriacall may override it during audio analysis. |
| `externalId` | `string \| null` | Optional call ID from your system. |
| `queueAnalysis` | `boolean` | Optional. Defaults to `true`; set `false` to upload now and queue later. |
| `agent.externalId` | `string` | Required agent ID from your system. |
| `agent.name` | `string` | Required when creating a new agent. |
| `agent.email` | `string \| null` | Optional agent email. |
| `agent.phone` | `string \| null` | Optional agent phone. |
| `lead.externalId` | `string` | Required lead/prospect ID from your system. |
| `lead.firstName` | `string` | Required when creating a new lead. |
| `lead.lastName` | `string` | Required when creating a new lead. |
| `lead.email` | `string \| null` | Optional lead email. |
| `lead.phone` | `string \| null` | Optional lead phone. |
| `lead.customFields` | `Record<string, unknown>` | Optional organization-defined lead custom fields. |
| `audio.file` | `Blob \| ArrayBuffer \| Uint8Array` | Required audio file data. In Node, a `Buffer` from `readFile()` can be passed directly. |
| `audio.filename` | `string` | Optional filename sent in multipart upload. |
| `audio.contentType` | `string` | Optional MIME type, for example `audio/mpeg`. |

```ts
import { readFile } from "node:fs/promises";

const buffer = await readFile("./call.mp3");

const response = await oriacall.calls.upload({
  idempotencyKey: "crm-call-789",
  externalId: "crm-call-789",
  objectiveId: "objective-id", // optional hint
  queueAnalysis: true,
  agent: {
    externalId: "agent-123",
    name: "Morgan Agent",
  },
  lead: {
    externalId: "prospect-456",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    customFields: {
      crm_stage: "qualified",
    },
  },
  audio: {
    file: buffer,
    filename: "call.mp3",
    contentType: "audio/mpeg",
  },
});

console.log(response.data.data.id, response.data.data.analysisStatus, response.requestId);
```

Call responses include objective selection metadata: `objectiveHint`, `identifiedObjective`, `objectiveSelectionSource`, `objectiveIdentificationConfidence`, and `analysisStage`. Call detail analysis includes user-visible organization detections in `organizationDetectedTags` and `organizationDetectedParams`. Hidden global detections are never exposed by the API or SDK.

Returns: `Promise<OriacallApiResponse<CallResponse>>`.

### `oriacall.calls.queueAnalysis(callId)`

Queues analysis for a call that was uploaded with `queueAnalysis: false`.

Required scope: `calls:write`.

```ts
const response = await oriacall.calls.queueAnalysis("call-id");
console.log(response.data.data.analysisStatus, response.data.data.queueStatus);
```

Returns: `Promise<OriacallApiResponse<CallResponse>>`.

### `oriacall.calls.waitForAnalysis(callId, options?)`

Polls `oriacall.calls.get(callId)` until the call analysis status is `completed` or `failed`.

Required scope: `calls:read`.

Options: `WaitForAnalysisOptions`

| Option | Type | Description |
| --- | --- | --- |
| `intervalMs` | `number` | Poll interval. Defaults to `2000`. |
| `timeoutMs` | `number` | Timeout before throwing `analysis_timeout`. Defaults to `120000`. |

```ts
const response = await oriacall.calls.waitForAnalysis("call-id", { timeoutMs: 180000 });
console.log(response.data.data.analysis);
```

Returns: `Promise<OriacallApiResponse<CallDetailResponse>>`.

### `oriacall.calls.paginate(options?)`

Iterates organization calls across all pages.

Required scope: `calls:read`.

Options: `ListCallsOptions`

```ts
for await (const call of oriacall.calls.paginate({ leadId: "lead-id" })) {
  console.log(call.id);
}
```

Returns: `AsyncGenerator<CallSummary>`.

### `oriacall.leads.list(options?)`

Lists organization leads. The `leads:read` scope includes lead email and phone contact details.

Lead records include nullable `externalId` when you store an ID from another system, and a `customFields` object for organization-defined CRM fields.

Required scope: `leads:read`.

Options: `ListLeadsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `limit` | `number` | Number of leads to return. Defaults to `50`; maximum is `100`. |
| `cursor` | `string` | Cursor from the previous response. |
| `objectiveId` | `string` | Optional objective ID filter. |
| `createdAfter` | `string` | Optional ISO 8601 lower bound for lead creation time. |
| `createdBefore` | `string` | Optional ISO 8601 upper bound for lead creation time. |
| `customFields` | `Record<string, CustomFieldFilterValue>` | Optional filters on lead custom fields. |

```ts
const response = await oriacall.leads.list({
  limit: 50,
  objectiveId: "objective-id",
  customFields: {
    crm_stage: "qualified",
    deal_value: { gte: 10000 },
  },
});

for (const lead of response.data.data) {
  console.log(lead.id, lead.externalId, lead.email, lead.phone, lead.customFields);
}
```

Returns: `Promise<OriacallApiResponse<LeadsListResponse>>`.

### `oriacall.leads.get(leadId)`

Gets a lead detail record, including email and phone contact details.

Required scope: `leads:read`.

```ts
const response = await oriacall.leads.get("lead-id");
console.log(response.data.data.externalId, response.data.data.email, response.data.data.phone, response.data.data.customFields);
```

Returns: `Promise<OriacallApiResponse<LeadDetailResponse>>`.

### `oriacall.leads.update(leadId, input)`

Updates a lead and/or its custom fields.

Required scope: `leads:write`.

Input: `LeadUpdateRequest`

```ts
const response = await oriacall.leads.update("lead-id", {
  email: "ada@example.com",
  customFields: {
    crm_stage: "qualified",
    renewal_date: "2026-09-01",
  },
});

console.log(response.data.data.customFields);
```

Returns: `Promise<OriacallApiResponse<LeadDetailResponse>>`.

### `oriacall.leads.upsertByExternalId(externalId, input)`

Creates or updates a lead by the integrating CRM/system ID. This is the preferred write method for CRM integrations because callers can use their own stable lead ID.

Required scope: `leads:write`.

Input: `LeadUpsertRequest`

```ts
const response = await oriacall.leads.upsertByExternalId("hubspot_123", {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  customFields: {
    crm_stage: "qualified",
    deal_value: 12000,
  },
});

console.log(response.data.data.id, response.data.data.customFields);
```

Returns: `Promise<OriacallApiResponse<LeadDetailResponse>>`.

### `oriacall.leads.paginate(options?)`

Iterates organization leads across all pages.

Required scope: `leads:read`.

Options: `ListLeadsOptions`

```ts
for await (const lead of oriacall.leads.paginate({ createdAfter: "2026-01-01T00:00:00.000Z" })) {
  console.log(lead.id, lead.externalId);
}
```

Returns: `AsyncGenerator<Lead>`.

### `oriacall.leadCustomFields.list(options?)`

Lists organization lead custom field definitions.

Required scope: `leads:read`.

Options: `ListLeadCustomFieldsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `includeArchived` | `boolean` | Include archived definitions. Defaults to `false`. |

```ts
const response = await oriacall.leadCustomFields.list();
console.log(response.data.data);
```

Returns: `Promise<OriacallApiResponse<LeadCustomFieldsListResponse>>`.

### `oriacall.leadCustomFields.create(input)`

Creates a lead custom field definition. Supported types are `text`, `number`, `boolean`, `date`, `datetime`, `select`, and `multi_select`.

Required scope: `lead_custom_fields:manage`.

Input: `LeadCustomFieldCreateRequest`

```ts
const response = await oriacall.leadCustomFields.create({
  key: "crm_stage",
  label: "CRM Stage",
  type: "select",
  options: ["new", "qualified", "customer"],
  isFilterable: true,
});

console.log(response.data.data.key);
```

Returns: `Promise<OriacallApiResponse<LeadCustomFieldResponse>>`.

### `oriacall.leadCustomFields.update(key, input)`

Updates mutable metadata for a lead custom field definition. Field keys and types are immutable.

Required scope: `lead_custom_fields:manage`.

Input: `LeadCustomFieldUpdateRequest`

```ts
await oriacall.leadCustomFields.update("crm_stage", {
  label: "CRM Pipeline Stage",
  archived: false,
});
```

Returns: `Promise<OriacallApiResponse<LeadCustomFieldResponse>>`.

### `oriacall.objectiveCustomFields.list(options?)`

Lists organization objective custom field definitions.

Required scope: `objectives:read`.

Options: `ListObjectiveCustomFieldsOptions`

| Option | Type | Description |
| --- | --- | --- |
| `includeArchived` | `boolean` | Include archived definitions. Defaults to `false`. |

```ts
const response = await oriacall.objectiveCustomFields.list();
console.log(response.data.data);
```

Returns: `Promise<OriacallApiResponse<ObjectiveCustomFieldsListResponse>>`.

### `oriacall.objectiveCustomFields.create(input)`

Creates an objective custom field definition. Supported types are `text`, `number`, `boolean`, `date`, `datetime`, `select`, and `multi_select`.

Required scope: `objective_custom_fields:manage`.

Input: `ObjectiveCustomFieldCreateRequest`

```ts
const response = await oriacall.objectiveCustomFields.create({
  key: "region",
  label: "Region",
  type: "select",
  options: ["north", "south"],
  isFilterable: true,
});

console.log(response.data.data.key);
```

Returns: `Promise<OriacallApiResponse<ObjectiveCustomFieldResponse>>`.

### `oriacall.objectiveCustomFields.update(key, input)`

Updates mutable metadata for an objective custom field definition. Field keys and types are immutable.

Required scope: `objective_custom_fields:manage`.

Input: `ObjectiveCustomFieldUpdateRequest`

```ts
await oriacall.objectiveCustomFields.update("region", {
  label: "Sales Region",
  archived: false,
});
```

Returns: `Promise<OriacallApiResponse<ObjectiveCustomFieldResponse>>`.

### `oriacall.webhooks.endpoints.list(options?)`

Lists webhook endpoints for the authenticated API client.

Required scope: `webhooks:read`.

Options: `ListWebhookEndpointsOptions`

```ts
const response = await oriacall.webhooks.endpoints.list({ limit: 50 });
console.log(response.data.data);
```

Returns: `Promise<OriacallApiResponse<WebhookEndpointsListResponse>>`.

### `oriacall.webhooks.endpoints.create(input)`

Creates a webhook endpoint. The signing secret is returned only once in this response.

Required scope: `webhooks:write`.

Input: `WebhookEndpointCreateRequest`

```ts
const response = await oriacall.webhooks.endpoints.create({
  url: "https://example.com/oriacall/webhooks",
  events: ["analysis.completed", "analysis.failed"],
});

console.log(response.data.data.id, response.data.data.secret);
```

Returns: `Promise<OriacallApiResponse<WebhookEndpointSecretResponse>>`.

### `oriacall.webhooks.endpoints.update(endpointId, input)`

Updates a webhook endpoint URL, event subscriptions, or active state.

Required scope: `webhooks:write`.

Input: `WebhookEndpointUpdateRequest`

```ts
const response = await oriacall.webhooks.endpoints.update("endpoint-id", {
  events: ["analysis.completed"],
  isActive: true,
});
```

Returns: `Promise<OriacallApiResponse<WebhookEndpointResponse>>`.

### `oriacall.webhooks.endpoints.delete(endpointId)`

Deletes a webhook endpoint.

Required scope: `webhooks:write`.

```ts
await oriacall.webhooks.endpoints.delete("endpoint-id");
```

Returns: `Promise<OriacallApiResponse<null>>`.

### `oriacall.webhooks.endpoints.rotateSecret(endpointId)`

Rotates the endpoint signing secret. The new secret is returned only once.

Required scope: `webhooks:write`.

```ts
const response = await oriacall.webhooks.endpoints.rotateSecret("endpoint-id");
console.log(response.data.data.secret);
```

Returns: `Promise<OriacallApiResponse<WebhookEndpointSecretResponse>>`.

### `oriacall.webhooks.endpoints.test(endpointId)`

Queues a `webhook.test` delivery to validate endpoint reachability and signature verification.

Required scope: `webhooks:write`.

```ts
const response = await oriacall.webhooks.endpoints.test("endpoint-id");
console.log(response.data.data.eventType, response.data.data.status);
```

Returns: `Promise<OriacallApiResponse<WebhookTestResponse>>`.

### `oriacall.webhooks.endpoints.paginate(options?)`

Iterates webhook endpoints across all pages.

Required scope: `webhooks:read`.

```ts
for await (const endpoint of oriacall.webhooks.endpoints.paginate({ limit: 50 })) {
  console.log(endpoint.id, endpoint.events);
}
```

Returns: `AsyncGenerator<WebhookEndpoint>`.

### `verifyOriacallWebhookSignature(input)`

Verifies a webhook HMAC signature. Pass the raw request body string exactly as received.

```ts
import { verifyOriacallWebhookSignature } from "@oriacall/sdk";

const valid = await verifyOriacallWebhookSignature({
  body: rawBody,
  secret: process.env.ORIACALL_WEBHOOK_SECRET!,
  signature: request.headers.get("Oriacall-Signature") ?? "",
  timestamp: request.headers.get("Oriacall-Timestamp") ?? "",
});
```

Returns: `Promise<boolean>`.

## Lower-Level Calls

For advanced integrations, `raw` exposes a typed lower-level OpenAPI client. You must attach authorization yourself.

```ts
const { data, error } = await oriacall.raw.GET("/v1/hello", {
  headers: {
    Authorization: `Bearer ${await oriacall.getAccessToken()}`,
  },
});
```

## Errors

API errors throw `OriacallApiError`.

```ts
import { OriacallApiError, createOriacallClient } from "@oriacall/sdk";

try {
  await oriacall.calls.list({ limit: 50 });
} catch (error) {
  if (error instanceof OriacallApiError) {
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
| `response` | `OriacallErrorResponse \| undefined` | Full API error response when available. |

Common API error codes:

```text
missing_token
invalid_token
invalid_client
invalid_scope
insufficient_scope
rate_limited
invalid_request
internal_error
call_not_found
call_external_id_conflict
analysis_already_queued
analysis_timeout
ai_config_missing
evaluation_grid_missing
audio_not_found
idempotency_key_conflict
idempotency_key_in_progress
lead_not_found
custom_field_not_found
custom_field_conflict
```

## Retries

Configure retry/backoff for safe SDK-managed requests. The SDK retries token requests and GET endpoints for `429`, `500`, `502`, `503`, and `504`, and respects `Retry-After` when present.

```ts
const oriacall = createOriacallClient({
  clientId: process.env.ORIACALL_CLIENT_ID!,
  clientSecret: process.env.ORIACALL_CLIENT_SECRET!,
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
https://api.oriacall.com
```

If Oriacall support gives you a custom API base URL, pass it explicitly:

```ts
const oriacall = createOriacallClient({
  baseUrl: "https://api.oriacall.com",
  clientId: process.env.ORIACALL_CLIENT_ID!,
  clientSecret: process.env.ORIACALL_CLIENT_SECRET!,
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
  CallResponse,
  CallsListResponse,
  CallSummary,
  CallUploadMetadata,
  CustomFieldFilters,
  CustomFieldFilterValue,
  HelloResponse,
  Lead,
  LeadCustomField,
  LeadCustomFieldCreateRequest,
  LeadCustomFieldResponse,
  LeadCustomFieldUpdateRequest,
  LeadCustomFieldsListResponse,
  LeadDetailResponse,
  LeadUpdateRequest,
  LeadUpsertRequest,
  LeadsListResponse,
  ListAgentsOptions,
  ListCallsOptions,
  ListLeadCustomFieldsOptions,
  ListLeadsOptions,
  ListObjectiveCustomFieldsOptions,
  ListObjectivesOptions,
  ListWebhookEndpointsOptions,
  Objective,
  ObjectiveCustomField,
  ObjectiveCustomFieldCreateRequest,
  ObjectiveCustomFieldResponse,
  ObjectiveCustomFieldUpdateRequest,
  ObjectiveCustomFieldsListResponse,
  ObjectiveResponse,
  ObjectiveUpdateRequest,
  ObjectivesListResponse,
  UploadCallInput,
  VerifyWebhookSignatureInput,
  OriacallApiResponse,
  OriacallClientOptions,
  OriacallErrorResponse,
  OriacallResponseEvent,
  OriacallResponseMetadata,
  WaitForAnalysisOptions,
  WebhookEndpoint,
  WebhookEndpointCreateRequest,
  WebhookEndpointResponse,
  WebhookEndpointSecretResponse,
  WebhookEndpointUpdateRequest,
  WebhookEndpointsListResponse,
  WebhookEventPayload,
  WebhookTestResponse,
} from "@oriacall/sdk";
```

Generated OpenAPI-derived types are included in the package declaration files, so editors can inspect the exact response fields for each method.

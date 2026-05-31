# @vuevox/sdk

TypeScript SDK for the VueVox Developer API.

## Install

This package is private until the first public release. From this repository:

```bash
cd sdks/typescript
npm install
npm run generate
npm run build
```

## Usage

```ts
import { createVueVoxClient } from "@vuevox/sdk";

const vuevox = createVueVoxClient({
  baseUrl: "https://api.vuevox.com",
  clientId: process.env.VUEVOX_CLIENT_ID!,
  clientSecret: process.env.VUEVOX_CLIENT_SECRET!,
  scope: "hello:read",
});

const hello = await vuevox.hello();
console.log(hello.message);
```

The SDK requests and caches a short-lived access token using client credentials, then sends it as a bearer token for API calls.

## Development

The generated API types come from `../../openapi/openapi.yaml`.

```bash
npm run generate
npm run typecheck
npm run build
```

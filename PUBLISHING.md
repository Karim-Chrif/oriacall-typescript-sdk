# Internal Publishing Checklist

This checklist is for maintainers publishing `@oriacall/sdk` to npm. It is not included in the npm package.

## Versioning

Use semantic versioning:

```text
patch: docs, internal fixes, SDK bug fixes with no API contract change
minor: new endpoints, new optional fields, new SDK methods
major: breaking API or SDK changes
```

## Pre-Publish Checklist

From the SDK package directory:

```bash
npm install
npx openapi-typescript ../../openapi/openapi.yaml -o src/generated/schema.d.ts
npm run typecheck
npm run build
npm run pack:dry-run
npm run publish:dry-run
```

Confirm the dry-run tarball includes only expected package files:

```text
package/dist/index.js
package/dist/index.d.ts
package/dist/client.js
package/dist/client.d.ts
package/dist/errors.js
package/dist/errors.d.ts
package/dist/generated/schema.d.ts
package/README.md
package/package.json
```

## Publish

Publishing requires npm permission for the `@oriacall` scope.

```bash
npm whoami
npm publish --access public
```

## After Publish

```bash
npm view @oriacall/sdk version
npm view @oriacall/sdk files
```

## Bad Release Handling

Do not unpublish unless the package contains secrets or legally problematic content. For broken releases, publish a fixed patch version and deprecate the bad version:

```bash
npm deprecate @oriacall/sdk@0.1.0 "Use 0.1.1 instead."
```

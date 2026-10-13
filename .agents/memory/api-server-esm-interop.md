---
name: API server ESM interop
description: Runtime import compatibility for dependencies externalized from the shared API server bundle.
---

The shared API server runs as native Node ESM while esbuild leaves several dependencies external. Some CommonJS packages can pass TypeScript and bundling with named imports but fail when Node loads the service; use the package's default namespace import for runtime exports.

**Why:** Node rejected named runtime exports from `jsonwebtoken` and `mongoose` in the externalized ESM bundle even though typechecking and bundling passed.

**How to apply:** When adding or changing an API-server dependency, check whether it is externalized and verify the actual workflow startup, not only TypeScript compilation.

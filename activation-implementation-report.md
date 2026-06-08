# EmpirePDF Feature Flag Activation Implementation Report

Generated: 2026-05-31

## Scope

Implemented the approved feature-flag architecture in:

- `src/app/api/tender-pack/generate/route.ts`

No frontend components, Firebase modules, Firestore logic, authentication logic, contractor workflows, renderer logic, templates, or calibration files were modified.

## Feature Flag

Flag name:

```text
EMPIREPDF_GENERATION_ENABLED
```

Default behavior:

- Missing flag: disabled
- `EMPIREPDF_GENERATION_ENABLED=false`: disabled
- `EMPIREPDF_GENERATION_ENABLED=true`: enabled
- Also accepted as enabled: `1`, `yes`

## Behavior Implemented

When disabled:

- `/api/tender-pack/generate` continues to call `generateSimplePack(...)`.
- Persisted `templateKey` is `simple`.
- JSON response contract remains unchanged.

When enabled:

- `/api/tender-pack/generate` calls `generateMergedPack(deal, contractor)`.
- Persisted `templateKey` is `summary-sbd1-sbd4`.
- JSON response contract remains unchanged.

## Preserved Response Contract

The success response still returns:

- `success`
- `base64`
- `packId`
- `downloadURL`
- `missingFields`
- `warnings`

The current UI remains compatible because `requestTenderPackGeneration(...)` still receives JSON from the same route and `TenderPackGeneratorPanel` still reads the same fields.

## Verification

Confirmed by static diff/readback:

- `generateMergedPack` is imported only into `/api/tender-pack/generate`.
- `generateSimplePack` remains available and remains the default path when the flag is false or missing.
- `persistTenderPackPdf(...)` is still used for both paths.
- The existing JSON response shape was not changed.
- The main UI component and button were not modified.

Typecheck:

- `npm run typecheck` was attempted.
- It failed before checking this route because `.next/dev/types/routes.d.ts` currently contains syntax errors, including an unterminated template literal.
- No `.next` generated files were modified.

## Files Changed

- `src/app/api/tender-pack/generate/route.ts`
- `activation-implementation-report.md`
- `rollback-test-report.md`

## Activation Instructions

Current default:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

To activate EmpirePDF without code changes:

```text
EMPIREPDF_GENERATION_ENABLED=true
```

To deactivate without code changes:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

Restart or redeploy the runtime if environment variable changes are not hot-loaded by the hosting environment.

## Result

EmpirePDF generation can now be activated or deactivated through a single server-side feature flag while preserving the current UI route and JSON response behavior.

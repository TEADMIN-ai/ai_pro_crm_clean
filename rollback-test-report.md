# EmpirePDF Feature Flag Rollback Test Report

Generated: 2026-05-31

## Rollback Mechanism

Rollback is controlled by:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

Because the flag defaults to disabled, removing the variable also rolls the route back to `generateSimplePack(...)`.

## Rollback Path Verified

Static verification confirms:

- `generateSimplePack(...)` remains imported and callable.
- `generateSimplePack(...)` is used when `EMPIREPDF_GENERATION_ENABLED` is false, missing, or any value other than `true`, `1`, or `yes`.
- `/api/tender-pack/generate` remains the UI endpoint.
- No frontend component was changed.
- No button behavior was changed.
- JSON response fields are unchanged.

## Activation Path Verified

Static verification confirms:

- `generateMergedPack(deal, contractor)` is used when `EMPIREPDF_GENERATION_ENABLED` is enabled.
- The generated PDF is still persisted through `persistTenderPackPdf(...)`.
- The route still returns the existing JSON response consumed by the UI.
- The persisted `templateKey` distinguishes activated EmpirePDF output as `summary-sbd1-sbd4`.

## Test Command

Attempted:

```text
npm run typecheck
```

Result:

- Failed due to existing generated `.next/dev/types/routes.d.ts` syntax errors.
- Failure location was outside the modified route.
- The errors included `Unexpected keyword or identifier` and `Unterminated template literal`.

## Manual Rollback Procedure

1. Set:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

2. Restart or redeploy the app if required by the environment.
3. Generate a tender pack from the existing UI button.
4. Confirm the persisted pack metadata uses:

```text
templateKey: simple
```

5. Confirm response still contains:

- `success`
- `base64`
- `packId`
- `downloadURL`
- `missingFields`
- `warnings`

## Rollback Risk

Classification: LOW.

Reason:

- The route name did not change.
- The UI did not change.
- The old generator remains in place.
- The default behavior is the old generator.
- Rollback is a configuration change, not a code change.

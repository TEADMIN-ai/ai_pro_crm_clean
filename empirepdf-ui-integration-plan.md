# EmpirePDF UI Integration Plan

Generated: 2026-05-31

## Decision

The main `Generate Tender Pack` button can be switched to EmpirePDF with minimal route churn, but it should not be redirected directly from `/api/tender-pack/generate` to `GET /api/tender-pack` without changing the frontend response handling.

Recommended approach: keep the UI calling `/api/tender-pack/generate`, and feature-flag the server implementation of that route to call `generateMergedPack(...)` instead of `generateSimplePack(...)`.

## Frontend Trigger

Component:

- `src/components/documents/TenderPackGeneratorPanel.tsx`

Main action:

- Button text: `Generate Tender Pack`
- Click handler: `handleGenerate`
- Flow:
  1. `handleGenerate`
  2. `handleGeneratePack`
  3. `fetchCriticalMissingFields`
  4. `fetchContractorDetail`
  5. `generateTenderPackWithValidation(...)` locally
  6. `requestGeneration`
  7. `requestTenderPackGeneration(dealId, contractorId)`
  8. `POST /api/tender-pack/generate`

The UI expects an artifact-style JSON response and then opens `downloadURL` or `downloadUrl`.

## Current Server Route

Route:

- `POST /api/tender-pack/generate`

Current behavior:

- Authenticates privileged user.
- Loads deal and contractor.
- Runs compliance readiness gate.
- Calls `generateSimplePack(...)`.
- Persists generated PDF through `persistTenderPackPdf(...)`.
- Returns JSON containing `success`, `base64`, `packId`, `downloadURL`, `missingFields`, and `warnings`.

## Existing EmpirePDF Routes

`GET /api/tender-pack?dealId=...`

- Calls `generateMergedPack(...)`.
- Persists the merged PDF.
- Returns raw `application/pdf` bytes.
- Includes pack metadata in response headers:
  - `X-Tender-Pack-Id`
  - `X-Tender-Pack-Url`

`GET /api/tender-pack/preview-pdf?dealId=...`

- Calls `generateMergedPack(...)`.
- Returns raw `application/pdf` bytes.
- Does not persist or return JSON metadata.

## Compatibility Finding

Direct frontend redirect to the existing EmpirePDF GET route is not drop-in compatible because:

- The UI helper calls `response.json()`.
- `GET /api/tender-pack` returns PDF bytes, not JSON.
- The UI reads `payload.downloadURL`, `payload.downloadUrl`, `payload.packId`, `payload.missingFields`, and `payload.warnings`.
- The GET route places `downloadURL` in headers rather than a JSON body.

Drop-in compatible activation is possible if `/api/tender-pack/generate` keeps returning the same JSON shape while internally using `generateMergedPack(...)`.

## Minimal-Risk Implementation Plan

1. Add a server-side feature flag.
   - Suggested name: `EMPIREPDF_TENDER_PACK_ENABLED`.
   - Default: disabled.
   - Scope: `src/app/api/tender-pack/generate/route.ts`.

2. Keep `/api/tender-pack/generate` as the UI endpoint.
   - Do not change `requestTenderPackGeneration(...)`.
   - Do not change the button handler for first activation.

3. Under the flag, replace only the generator.
   - Disabled: current `generateSimplePack(...)`.
   - Enabled: existing `generateMergedPack(deal, contractor)`.

4. Preserve current JSON response.
   - Always return `success`, `packId`, `downloadURL`, `missingFields`, and `warnings`.
   - Keep `base64` optional. The UI does not currently use it when `downloadURL` exists.

5. Change persisted metadata under the flag.
   - Current: `templateKey: "simple"`.
   - EmpirePDF: `templateKey: "summary-sbd1-sbd4"`.
   - Keep `fieldMapUsed` containing `dealId`, `contractorId`, and ideally `templateIds`.

6. Keep rollback path in place.
   - Leave `generateSimplePack(...)` unchanged.
   - Disable the flag to restore current behavior.

7. Second-pass UI cleanup after activation.
   - Remove browser-side local PDF fallback from the main production path.
   - Replace local `generateTenderPackWithValidation(...)` gate with server-side EmpirePDF readiness once available.
   - Surface API warnings prominently in `View Compliance Status`.

## Feature Flag Feasibility

Feasible.

The switch can be contained to `/api/tender-pack/generate` because both generators return PDF bytes and both can be passed to `persistTenderPackPdf(...)`. The route already returns JSON metadata after persistence.

Suggested shape:

```text
if EMPIREPDF_TENDER_PACK_ENABLED:
  pdfBytes = await generateMergedPack(deal, contractor)
  templateKey = "summary-sbd1-sbd4"
else:
  pdfBytes = await generateSimplePack(...)
  templateKey = "simple"
```

## Rollback

Rollback already exists conceptually because `generateSimplePack(...)` remains available and currently backs the route. A feature flag makes rollback a configuration change instead of a route or UI revert.

## Risk Classification

| Area | Classification | Reason |
| --- | --- | --- |
| Activation risk | MEDIUM | Existing EmpirePDF generation works, but direct route redirect is response-incompatible and template source alignment is still required. |
| Rollback complexity | LOW | Keeping `/api/tender-pack/generate` and `generateSimplePack(...)` allows flag-based rollback. |
| Production readiness | MEDIUM | The safe path is clear, but final readiness depends on warning policy, candidate template source confirmation, and UI fallback cleanup. |

## Recommendation

Do not redirect the button directly to `GET /api/tender-pack`. Instead, keep the frontend route unchanged and make `/api/tender-pack/generate` use EmpirePDF behind `EMPIREPDF_TENDER_PACK_ENABLED`, preserving the current JSON response contract.

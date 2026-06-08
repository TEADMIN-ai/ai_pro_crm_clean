# Route Impact Analysis

Generated: 2026-05-31

## Routes Investigated

| Route | Current generator | EmpirePDF status | Impact |
| --- | --- | --- | --- |
| `POST /api/tender-pack/generate` | `generateSimplePack(...)` | Not active | Main activation target |
| `GET /api/tender-pack?dealId=...` | `generateMergedPack(...)` | Active | Already uses SBD1/SBD4 EmpirePDF path |
| `GET /api/tender-pack/preview-pdf?dealId=...` | `generateMergedPack(...)` | Active | Preview already uses merged SBD1/SBD4 path |
| `POST /api/tender/email` | `generateSimplePack(...)` | Not active | Should remain unchanged unless email attachments are upgraded |
| `POST /api/sbd4/generate` | Direct SBD4 overlay map | Not main pack path | Separate standalone SBD4 route |

## `/api/tender-pack/generate`

Current behavior:

- Authenticates privileged user.
- Reads `dealId` from request body.
- Loads deal and contractor from Firestore.
- Recalculates contractor compliance.
- Blocks if compliance is not ready.
- Calls `generateSimplePack(...)`.
- Persists with `templateKey: "simple"`.
- Returns JSON with `success`, `base64`, `packId`, `downloadURL`, `missingFields`, and `warnings`.

Required replacement:

- Keep auth, Firestore loading, and compliance gate unchanged.
- Replace only the PDF generation call:
  - from `generateSimplePack(...)`
  - to `generateMergedPack(deal, contractor)`
- Persist with a template key representing the merged pack, for example `summary-sbd1-sbd4`.
- Preserve the existing JSON response shape so the UI remains compatible.

Feature flag option:

```text
if EMPIREPDF_TENDER_PACK_ENABLED:
  pdfBytes = generateMergedPack(deal, contractor)
  templateKey = "summary-sbd1-sbd4"
else:
  pdfBytes = generateSimplePack(...)
  templateKey = "simple"
```

## `generateSimplePack`

Current callers:

- `src/app/api/tender-pack/generate/route.ts`
- `src/app/api/tender/email/route.ts`

Recommendation:

- Do not delete `generateSimplePack`.
- Do not modify it for EmpirePDF activation.
- Keep it as the rollback path for `/api/tender-pack/generate`.
- Keep it available for `/api/tender/email` until email pack attachments are explicitly upgraded.

## UI Actions Triggering Routes

Primary UI action:

- Component: `src/components/documents/TenderPackGeneratorPanel.tsx`
- Button text: `Generate Tender Pack`
- Handler: `handleGenerate`
- Internal flow: `handleGenerate` -> `handleGeneratePack` -> `requestGeneration` -> `requestTenderPackGeneration`
- API called: `/api/tender-pack/generate`

Individual document actions:

- `Generate SBD1` currently calls `handleGenerateReport`, which generates a report, not SBD1.
- `Generate SBD4` calls `handleGenerateSBD4`, which uses the older browser overlay path through `generateSBD4Overlay(...)`.

Other route constants:

- `API_ROUTES.TENDER_PACK(dealId)` maps to `GET /api/tender-pack?dealId=...`, which already uses `generateMergedPack`.
- `API_ROUTES.TENDER_PACK_PREVIEW_PDF(dealId)` maps to `GET /api/tender-pack/preview-pdf?dealId=...`, which already uses `generateMergedPack`.
- The main panel generation helper does not use those routes; it uses `TENDER_PACK_GENERATE`.

## Current Document Assembly Pipeline

Merged EmpirePDF pipeline:

1. `generateMergedPack(deal, contractor)`
2. Normalize deal and contractor.
3. Generate summary PDF through `generateTenderPdf(...)`.
4. Generate SBD1 through `fillSbd1(...)`.
5. Generate SBD4 through `fillSbd4(...)`.
6. Merge summary, SBD1, and SBD4 through `mergeTenderPack(...)`.
7. Persist through `persistTenderPackPdf(...)` in the route layer.

Simple-pack pipeline:

1. `generateSimplePack(deal, contractor)`
2. Create a new blank PDF.
3. Draw title, deal fields, contractor fields, and analysis text.
4. Persist through `persistTenderPackPdf(...)`.

## Template Impact

Active merged EmpirePDF template inputs:

- `public/templates/SBD1.pdf`
- `public/templates/SBD4.pdf`

Production candidate package files are not currently referenced by any route. Activation requires either:

- promoting selected candidate PDFs into `public/templates`, or
- adding an explicit production artifact resolver.

Important distinction:

The release package contains generated/rendered PDFs and calibration reports. Before replacing `public/templates`, verify whether the intended runtime source should be the rendered candidate PDFs or the original official blank templates plus checked-in bounding boxes/calibration overrides. If the candidate PDFs are acceptance outputs with filled data, they should not be used as blank runtime templates.

## Estimated Files Affected by Route Activation

Required:

- `src/app/api/tender-pack/generate/route.ts`
- `public/templates/SBD1.pdf`
- `public/templates/SBD4.pdf`
- Environment configuration

Likely:

- `src/components/documents/TenderPackGeneratorPanel.tsx`
- `src/lib/empirePdf/fillSbd1.ts`
- `src/lib/empirePdf/fillSbd4.ts`
- `src/lib/pdf/mergeTenderPack.ts`

Optional:

- `src/lib/tender/requestTenderPackGeneration.ts`
- Tests for routes and generation behavior

## Complexity

Route-only activation: Low to medium.

Production-safe activation with warning policy, feature flag, template promotion, and UI cleanup: Medium.

## Risks

- UI currently performs local PDF validation with a legacy path before server generation.
- Server response currently returns base64 as well as `downloadURL`; large merged PDFs may make base64 unnecessary or expensive.
- Switching `/api/tender-pack/generate` affects the main UI button immediately.
- Changing `generateSimplePack` directly would affect `/api/tender/email`; avoid this.
- Existing standalone SBD4 generation remains a separate legacy path and could confuse users unless labeled or removed later.

## Recommended Route Change

Do not change route names. Keep `/api/tender-pack/generate` as the live UI endpoint, but feature-flag its internal generator from simple pack to EmpirePDF merged pack. This gives clean activation and rollback without UI route churn.

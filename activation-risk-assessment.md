# EmpirePDF Activation Risk Assessment

Generated: 2026-05-31

## Summary Classification

| Category | Classification |
| --- | --- |
| Activation risk | MEDIUM |
| Rollback complexity | LOW |
| Production readiness | MEDIUM |

## Activation Risk: MEDIUM

Reasons:

- The main UI button currently targets a JSON API route backed by `generateSimplePack(...)`.
- Existing EmpirePDF routes return PDF bytes, not the JSON structure expected by the UI.
- A direct redirect from `/api/tender-pack/generate` to `GET /api/tender-pack` would break the current frontend helper.
- The safer route-internal swap is straightforward because `generateMergedPack(...)` already exists.
- Production candidate package activation still requires confirming the runtime template source for SBD1 and SBD4.

Risk reducers:

- `generateMergedPack(...)` is already used by `GET /api/tender-pack` and `/api/tender-pack/preview-pdf`.
- `persistTenderPackPdf(...)` already accepts generated PDF bytes from either generator.
- The UI already prefers a signed `downloadURL`, which the generate route can continue returning.

## Rollback Complexity: LOW

Reasons:

- `generateSimplePack(...)` currently exists and is the active implementation.
- `/api/tender-pack/generate` can retain the same route and switch behavior by feature flag.
- The UI does not need route changes for the recommended activation path.
- Disabling the flag can restore the current simple-pack path.

Rollback caveat:

- If candidate PDFs replace `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf`, template backups are required for full rollback.

## Production Readiness: MEDIUM

Reasons:

- EmpirePDF generation is present and callable through existing GET routes.
- SBD1/SBD4 production candidate packages exist.
- The current live button path is not yet using EmpirePDF.
- Existing EmpirePDF routes are not directly UI-compatible.
- Final-output warning handling is not yet enforced in `/api/tender-pack/generate`.
- The UI still has a browser-side local PDF fallback if no artifact URL is returned.

## Main Risks

1. Response mismatch.
   - Existing EmpirePDF GET routes return binary PDF responses.
   - The UI helper expects JSON.

2. Incorrect activation method.
   - Redirecting the UI to `GET /api/tender-pack` is higher risk than switching `/api/tender-pack/generate` internally.

3. Template source ambiguity.
   - `fillSbd1(...)` and `fillSbd4(...)` load `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf`.
   - Production candidate packages are not currently referenced by runtime code.

4. Warning policy gap.
   - The final route currently returns `warnings: []`.
   - EmpirePDF warnings and fallback status should be propagated before production hardening.

5. UI fallback behavior.
   - If the API returns no `downloadURL`, the UI downloads locally generated browser-side bytes.
   - That fallback could mask server-side activation failures.

## Recommended Minimal-Risk Switch

1. Keep `TenderPackGeneratorPanel` calling `requestTenderPackGeneration(...)`.
2. Keep `requestTenderPackGeneration(...)` posting to `/api/tender-pack/generate`.
3. Add `EMPIREPDF_TENDER_PACK_ENABLED` to `/api/tender-pack/generate`.
4. Under the flag, call `generateMergedPack(deal, contractor)`.
5. Persist the merged PDF with a distinct template key.
6. Return the same JSON response shape expected by the UI.
7. Keep `generateSimplePack(...)` as the disabled-flag rollback path.

## Files Likely Affected for Implementation

Minimum:

- `src/app/api/tender-pack/generate/route.ts`
- Environment configuration for `EMPIREPDF_TENDER_PACK_ENABLED`

Likely hardening:

- `src/components/documents/TenderPackGeneratorPanel.tsx`
- `src/lib/tender/requestTenderPackGeneration.ts`
- `src/lib/pdf/mergeTenderPack.ts`
- `src/lib/empirePdf/fillSbd1.ts`
- `src/lib/empirePdf/fillSbd4.ts`

Template/source alignment:

- `public/templates/SBD1.pdf`
- `public/templates/SBD4.pdf`
- or a new production template resolver if direct file replacement is not desired.

## Go/No-Go Recommendation

Go for a feature-flagged internal route swap.

No-go for direct frontend redirect to existing EmpirePDF GET routes until the frontend is changed to handle binary PDF responses and metadata headers.

Production activation should wait until:

- The selected SBD1/SBD4 candidate artifacts are confirmed as valid runtime template sources.
- The generate route returns the same JSON contract while using EmpirePDF.
- Fallback/warning behavior is visible and preferably blocking for final output.
- The local browser-side fallback is removed or restricted outside production.

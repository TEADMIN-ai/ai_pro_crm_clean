# Tender Pack Generation Flow

Generated: 2026-05-31

## Intended Workflow

Contractor Data -> Tender Intake -> EmpirePDF Field Resolution -> SBD1 Generation -> SBD4 Generation -> Tender Pack Assembly -> Downloadable PDF Package

## Actual Download Route

1. Client requests `GET /api/tender-pack?dealId=...`.
2. `src/app/api/tender-pack/route.ts` authenticates the user and loads the deal from Firestore.
3. The route reads `deal.contractorId`, then loads the contractor from Firestore.
4. `getMergedPackTemplateIds(deal)` returns `["summary", "sbd1", "sbd4"]`.
5. `generateMergedPack(deal, contractor)` normalizes deal and contractor data.
6. `generateTenderPdf(...)` creates the summary PDF.
7. `fillSbd1(...)` loads `public/templates/SBD1.pdf` and calls `fillTemplateWithIntelligence({ templateKey: "sbd1" })`.
8. `fillSbd4(...)` loads `public/templates/SBD4.pdf` and calls `fillTemplateWithIntelligence({ templateKey: "sbd4" })`.
9. `mergeTenderPack(...)` merges summary, SBD1, SBD4, and optional supporting PDFs.
10. `persistTenderPackPdf(...)` writes the PDF to Firebase Storage and records metadata in `tenderPacks`.
11. The route returns the PDF response with `Content-Type: application/pdf` and tender-pack headers.

## Actual Preview PDF Route

1. Client requests `GET /api/tender-pack/preview-pdf?dealId=...`.
2. The route performs the same deal and contractor lookup.
3. It calls `generateMergedPack(deal, contractor)`.
4. It returns the merged PDF bytes without persistence metadata.

## Visible Generator Panel Route

1. `TenderPackGeneratorPanel` loads contractor data and performs local SBD1 validation through `generateTenderPackWithValidation(...)`.
2. If local validation passes, it calls `requestTenderPackGeneration(dealId, contractorId)`.
3. `requestTenderPackGeneration(...)` posts to `/api/tender-pack/generate`.
4. `/api/tender-pack/generate` checks compliance readiness, then calls `generateSimplePack(...)`.
5. `generateSimplePack(...)` creates a simple summary-style PDF, not the merged SBD1/SBD4 EmpirePDF pack.
6. The simple pack is persisted and returned as base64 plus storage metadata.

## EmpirePDF Field Resolution

1. `fillTemplateWithIntelligence(...)` selects the template definition from `EMPIRE_PDF_TEMPLATE_REGISTRY`.
2. It builds a semantic profile from contractor data.
3. It builds an anchor resolver from the active template PDF bytes.
4. For each template field, it detects the configured anchor text.
5. It resolves semantic data through `resolveSemanticField(...)`.
6. It suppresses `SBD1.signature_name` when no calibrated bounding box, high-confidence signature anchor, or explicit signature metadata exists.
7. It calls `renderTemplateField(...)` for non-suppressed fields.
8. It validates rendered field placement and records warnings, review flags, confidence, and debug fields.

## Pack Assembly

Current merged pack order:

1. Summary PDF
2. SBD1 PDF
3. SBD4 PDF
4. Optional supporting PDFs, if supplied

Current `getMergedPackTemplateIds(...)` output:

```text
summary, sbd1, sbd4
```

## Flow Gaps

- The UI generator panel does not call the merged-pack endpoint after server generation succeeds; it posts to the simple-pack endpoint.
- The merged-pack endpoint exists and uses EmpirePDF SBD1/SBD4, but it is not the endpoint used by `requestTenderPackGeneration(...)`.
- The active SBD1/SBD4 template files are not sourced from the Production Candidate release directories.
- Local browser-side validation uses the older `src/lib/pdf/tenderPack.ts` path before the server simple-pack request.
- The final pack does not include SBD2, SBD3, SBD5, SBD6, SBD7, SBD8, SBD9, annexures, addendums, or supporting compliance documents.

## Production Flow Recommendation

Make one canonical production path:

Contractor and deal data -> server-side readiness validation -> `generateMergedPack(...)` -> SBD1/SBD4 EmpirePDF intelligent fill -> pack merge -> `persistTenderPackPdf(...)` -> signed download URL.

The canonical path should hard-fail or visibly block if intelligent fill produces warnings for final output.

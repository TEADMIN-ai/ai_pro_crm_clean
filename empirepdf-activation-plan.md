# EmpirePDF Activation Plan

Generated: 2026-05-31

## Objective

Make the live Tender Pack workflow use the calibrated SBD1 and SBD4 EmpirePDF production candidate documents:

- `E:\TorqueEmpire\01_CRM\Releases\SBD1_v1_Production_Candidate`
- `E:\TorqueEmpire\01_CRM\Releases\SBD4_v1_Production_Candidate`

No activation has been performed in this investigation.

## Current Divergence

The live UI button does not currently use the server-side EmpirePDF merged pack path.

Current UI generation path:

1. `TenderPackGeneratorPanel` button `Generate Tender Pack` calls `handleGenerate`.
2. `handleGenerate` calls `handleGeneratePack`.
3. `handleGeneratePack` calls `generateTenderPackWithValidation(...)` locally for browser-side SBD validation.
4. If validation passes, it calls `requestTenderPackGeneration(dealId, contractorId)`.
5. `requestTenderPackGeneration(...)` posts to `/api/tender-pack/generate`.
6. `/api/tender-pack/generate` calls `generateSimplePack(...)`.
7. `generateSimplePack(...)` produces a simple one-page summary PDF, not the calibrated SBD1/SBD4 EmpirePDF pack.

Existing EmpirePDF path:

1. `GET /api/tender-pack?dealId=...` calls `generateMergedPack(...)`.
2. `generateMergedPack(...)` calls `fillSbd1(...)` and `fillSbd4(...)`.
3. `fillSbd1(...)` loads `public/templates/SBD1.pdf`.
4. `fillSbd4(...)` loads `public/templates/SBD4.pdf`.
5. The summary, SBD1, and SBD4 PDFs are merged and persisted.

## Activation Requirements

1. Promote production candidate templates into the runtime source of truth.
   - Either copy/replace active runtime templates at `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf`, or add a controlled template resolver that reads from an internal production artifact path.
   - The simplest activation path is to replace the two `public/templates` PDFs with approved candidate PDFs after backing up the current files.

2. Change the `/api/tender-pack/generate` implementation path.
   - Replace the `generateSimplePack(...)` call with `generateMergedPack(deal, contractor)`.
   - Preserve the existing compliance gate and `persistTenderPackPdf(...)` behavior.
   - Change persisted `templateKey` from `"simple"` to something like `"summary-sbd1-sbd4"` or the output of `getMergedPackTemplateIds(deal).join("-")`.

3. Align the UI with the server source of truth.
   - Keep the pre-generation readiness modal if useful.
   - Remove or bypass browser-side `generateTenderPackWithValidation(...)` as a final gate once server-side EmpirePDF validation exists.
   - Ensure the UI opens the signed `downloadURL` returned by `/api/tender-pack/generate`.

4. Add final-output warning policy.
   - For production, warnings from EmpirePDF should be persisted and surfaced.
   - Decide whether `Anchor fallback used`, low-confidence resolution, or validation warnings block final generation.
   - Recommended: hard-block final generation when active calibrated SBD1/SBD4 fields use fallback placement.

5. Wire a feature flag.
   - Add a server-side flag such as `EMPIREPDF_TENDER_PACK_ENABLED`.
   - When disabled, `/api/tender-pack/generate` uses the current `generateSimplePack(...)` path.
   - When enabled, `/api/tender-pack/generate` uses `generateMergedPack(...)`.
   - Optional second flag: `EMPIREPDF_FINAL_WARNINGS_BLOCK=true`.

## Recommended Activation Sequence

1. Baseline and backup.
   - Record checksums and file sizes for `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf`.
   - Copy current templates to a rollback folder.
   - Record current `/api/tender-pack/generate` behavior and one known-good simple-pack output.

2. Promote candidate templates.
   - Decide exact source PDFs:
     - SBD1 likely candidate: `SBD1_v1_Production_Candidate\PDFs\signature-name-suppression-after.pdf` or `finetune-after.pdf`, depending on final visual signoff.
     - SBD4 likely candidate: `SBD4_v1_Production_Candidate\PDFs\sbd4.calibration.pdf`.
   - Replace or resolver-map these into the runtime SBD1/SBD4 template source.

3. Add feature flag plumbing.
   - Introduce server-side runtime flag in `/api/tender-pack/generate`.
   - Default flag should be off until QA confirms output.

4. Swap generator under flag.
   - Keep compliance readiness gate unchanged.
   - Under the flag, call `generateMergedPack(deal, contractor)`.
   - Persist with `templateKey: "summary-sbd1-sbd4"`.
   - Return the same response shape currently expected by `requestTenderPackGeneration(...)`.

5. Add production warning handling.
   - Capture warnings from SBD1/SBD4 generation or expose an engine result from `fillSbd1` and `fillSbd4`.
   - Block or mark not-ready when fallback placement occurs for active calibrated fields.

6. Update UI flow.
   - Keep the button route as `/api/tender-pack/generate` for continuity.
   - Remove the client-side local PDF fallback download after server activation, or keep it only behind a development/debug path.
   - Ensure warnings returned by the API appear in `View Compliance Status`.

7. QA with feature flag on in non-production.
   - Generate pack through the actual UI button.
   - Confirm signed URL opens the merged summary + SBD1 + SBD4 package.
   - Confirm no simple-pack PDF is produced.
   - Confirm SBD1 signature suppression still holds.
   - Confirm no fallback anchor placements for active calibrated fields.

8. Production activation.
   - Enable `EMPIREPDF_TENDER_PACK_ENABLED`.
   - Monitor generated `tenderPacks` records for template key, file size, warnings, and storage path.
   - Keep rollback templates and flag available.

## Estimated Files Affected

Minimum activation:

- `src/app/api/tender-pack/generate/route.ts`
- `src/lib/pdf/mergeTenderPack.ts` if result metadata or warning propagation is added
- `src/lib/empirePdf/fillSbd1.ts` if source artifact resolution or warning return shape changes
- `src/lib/empirePdf/fillSbd4.ts` if source artifact resolution or warning return shape changes
- `src/components/documents/TenderPackGeneratorPanel.tsx` if local validation/fallback behavior is adjusted
- `src/lib/tender/requestTenderPackGeneration.ts` only if response shape changes
- `public/templates/SBD1.pdf`
- `public/templates/SBD4.pdf`
- Environment configuration for `EMPIREPDF_TENDER_PACK_ENABLED`

Estimated range: 6 to 9 files plus 2 template artifacts.

## Estimated Implementation Complexity

Medium.

The merged EmpirePDF generation function already exists, and the response contract from `/api/tender-pack/generate` can be preserved. The main complexity is not rendering; it is source-of-truth alignment, warning policy, UI fallback cleanup, and rollback-safe feature-flagging.

## Risks

- Candidate PDFs may not be the correct files to use as runtime templates if they are rendered output rather than blank official templates.
- `fillSbd1` and `fillSbd4` currently load `public/templates` directly, so release-package artifacts are not active unless promoted or resolved.
- Existing intelligent-fill functions return only PDF bytes, not structured warnings, so production warning policy may require small API contract changes.
- The current UI can fall back to locally generated bytes if the server response lacks a download URL.
- `generateSimplePack` is also used by `/api/tender/email`; replacing it globally would unintentionally affect email readiness flow.
- Existing QA reported one fallback for `SBD1.bbbee_status` in a foreign supplier edge case.

## Recommendation

Activate EmpirePDF by feature-flagging `/api/tender-pack/generate` to call `generateMergedPack(...)`, while leaving `generateSimplePack(...)` available for rollback and email route compatibility. Promote the production candidate artifacts into the runtime template source only after confirming which candidate PDFs are intended as fillable/base templates versus rendered acceptance outputs.

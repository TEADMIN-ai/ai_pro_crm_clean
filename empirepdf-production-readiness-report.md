# EmpirePDF Production Readiness Report

Generated: 2026-05-31

## Executive Assessment

Status: Not production-ready for live contractor tender packs.

SBD1 and SBD4 Production Candidate release packages exist under `E:\TorqueEmpire\01_CRM\Releases`, and the release verification report shows both packages succeeded with no missing copied artifacts. However, the live CRM generation paths do not reference `SBD1_v1_Production_Candidate` or `SBD4_v1_Production_Candidate`. The active merged-pack code reads `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf` directly.

## Production Candidate Reference Check

| Check | Result | Evidence |
| --- | --- | --- |
| SBD1 package exists | Pass | `E:\TorqueEmpire\01_CRM\Releases\SBD1_v1_Production_Candidate` |
| SBD4 package exists | Pass | `E:\TorqueEmpire\01_CRM\Releases\SBD4_v1_Production_Candidate` |
| Release verification exists | Pass | `E:\TorqueEmpire\01_CRM\Releases\release-verification-report.md` |
| SBD1 package is referenced by production code | Fail | No `SBD1_v1_Production_Candidate` reference found in `src` or `scripts` |
| SBD4 package is referenced by production code | Fail | No `SBD4_v1_Production_Candidate` reference found in `src` or `scripts` |
| Legacy calibration output paths active in production | Pass | `output/pdf/*calibration*` paths are only referenced by QA/calibration scripts |

## Active Generation Paths

Primary downloadable route:

- `src/app/api/tender-pack/route.ts:57` calls `generateMergedPack(deal, contractor)`.
- `src/lib/pdf/mergeTenderPack.ts:147` calls `fillSbd1(...)`.
- `src/lib/pdf/mergeTenderPack.ts:148` calls `fillSbd4(...)`.
- `src/lib/empirePdf/fillSbd1.ts:123` loads `public/templates/SBD1.pdf`.
- `src/lib/empirePdf/fillSbd4.ts:115` loads `public/templates/SBD4.pdf`.

Preview PDF route:

- `src/app/api/tender-pack/preview-pdf/route.ts:45` also calls `generateMergedPack(deal, contractor)`.

Visible generator panel path:

- `src/components/documents/TenderPackGeneratorPanel.tsx:217` calls `requestTenderPackGeneration(...)`.
- `src/lib/tender/requestTenderPackGeneration.ts:46` posts to `API_ROUTES.TENDER_PACK_GENERATE`.
- `src/lib/apiRoutes.ts:51` maps that route to `/api/tender-pack/generate`.
- `src/app/api/tender-pack/generate/route.ts:83` calls `generateSimplePack(...)`, not `generateMergedPack(...)`.

## Calibration and Fallback Status

SBD1 calibration:

- Active bounding boxes are registered through `src/lib/empirePdf/boundingBoxes/index.ts:13`.
- SBD1 applies `SBD1_CALIBRATION_OVERRIDES` through `src/lib/empirePdf/boundingBoxes/index.ts:56`.
- The packaged SBD1 source copy exists, but production reads the repo source, not the release package.

SBD4 calibration:

- Active bounding boxes are registered through `src/lib/empirePdf/boundingBoxes/index.ts:14`.
- No SBD4 calibration override module is active; SBD4 uses the checked-in bounding boxes.

Fallback risk:

- `src/lib/empirePdf/fillSbd1.ts:164` falls back to legacy overlay rendering if intelligent fill fails.
- `src/lib/empirePdf/fillSbd4.ts:154` falls back to legacy overlay rendering if intelligent fill fails.
- `src/lib/empirePdf/intelligentFillEngine.ts:242` adds warnings when `fallbackUsed` is true.
- Existing QA report shows one fallback in `foreign_supplier_edge_case`: `SBD1.bbbee_status`.

## Suppressed Field Verification

The SBD1 signature suppression verification artifact shows:

- `fields=15`
- `suppressed=1`
- `fallbacks=0`
- `validationWarnings=0`
- Suppressed field: `SBD1.signature_name`
- Resolution strategy: `not_rendered_suppressed`

This supports the specific suppression fix artifact. It does not prove that the live UI route uses the release package because live generation does not reference the release directory.

## Remaining Blockers

1. Live UI generation posts to `/api/tender-pack/generate`, which creates a simple one-page pack instead of the merged SBD1/SBD4 EmpirePDF pack.
2. Production code does not reference the SBD1 or SBD4 Production Candidate release directories.
3. Active template PDFs are `public/templates/SBD1.pdf` and `public/templates/SBD4.pdf`, not release package artifacts.
4. Intelligent-fill failure still permits legacy overlay fallback for SBD1 and SBD4.
5. Existing QA data still has one SBD1 fallback in the foreign supplier edge case.
6. The merged pack includes only `summary`, `sbd1`, and `sbd4`; complete tender-pack SBD coverage is not present.
7. Several registry entries reference missing template files in `src/lib/pdfs/templates/tender-packs`: `sbd2.pdf`, `sbd3.pdf`, `sbd5.pdf`, `sbd7.pdf`, `annexures.pdf`, and `addendums.pdf`.

## Missing SBD Forms for Complete Pack

Currently merged:

- Summary
- SBD1
- SBD4

Available but not included in the merged pack:

- SBD6
- SBD8
- SBD9
- Combined `sbd4-8-9.pdf`
- `sbdforms.pdf`
- `standardconditionsoftender.pdf`

Referenced but missing from `src/lib/pdfs/templates/tender-packs`:

- SBD2
- SBD3
- SBD5
- SBD7
- Annexures
- Addendums

## Hard-Coded Values Still Present

- `Authorized Signatory` in `src/lib/empirePdf/fillSbd1.ts:147`, `src/lib/empirePdf/fillSbd4.ts:137`, and `src/lib/empirePdf/semanticContext.ts:95`.
- `None` relationship declaration in `src/lib/empirePdf/fillSbd4.ts:174` and `src/lib/empirePdf/semanticContext.ts:93`.
- Current date generated at runtime through `new Date().toLocaleDateString("en-ZA")`.
- `N/A` fallbacks in `fillSbd1`, `fillSbd4`, and `generateSimplePack`.
- `LOW` default risk level in `src/lib/pdf/mergeTenderPack.ts:59`.

## Recommendation

Do not promote EmpirePDF tender-pack generation to production until the live UI route, API route, and template source are aligned with the SBD1/SBD4 Production Candidate artifacts, and until fallback behavior is either disabled for final output or surfaced as a hard deployment blocker.

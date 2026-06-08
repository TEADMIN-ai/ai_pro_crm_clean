# Document Dependency Map

Generated: 2026-05-31

## Release Packages

| Package | Status | Current production reference |
| --- | --- | --- |
| `E:\TorqueEmpire\01_CRM\Releases\SBD1_v1_Production_Candidate` | Exists | Not referenced |
| `E:\TorqueEmpire\01_CRM\Releases\SBD4_v1_Production_Candidate` | Exists | Not referenced |
| `E:\TorqueEmpire\01_CRM\Releases\release-verification-report.md` | Exists | Not referenced |

## Active Runtime Documents

| Document | Active path | Used by |
| --- | --- | --- |
| SBD1 | `public/templates/SBD1.pdf` | `src/lib/empirePdf/fillSbd1.ts` |
| SBD4 | `public/templates/SBD4.pdf` | `src/lib/empirePdf/fillSbd4.ts` |
| Summary PDF | generated dynamically | `src/lib/pdf/generateTenderPdf.ts` |
| Simple pack | generated dynamically | `src/lib/pdf/generateSimplePack.ts` |

## EmpirePDF Registry Dependencies

| Component | Dependency |
| --- | --- |
| `EMPIRE_PDF_TEMPLATE_REGISTRY` | Registers SBD1, SBD4, and SBD6.1 |
| `SBD1_TEMPLATE` | Declares template version `sbd1-sa-v1` and `pdfRelativePath: src/lib/pdfs/templates/tender-packs/sbd1.pdf` |
| `SBD4_TEMPLATE` | Declares template version `sbd4-sa-v1` and `pdfRelativePath: src/lib/pdfs/templates/tender-packs/sbd4.pdf` |
| `fillTemplateWithIntelligence(...)` | Uses registry metadata, but renders against the template bytes passed by caller |
| `fillSbd1(...)` | Passes bytes from `public/templates/SBD1.pdf` |
| `fillSbd4(...)` | Passes bytes from `public/templates/SBD4.pdf` |

## Bounding Box and Calibration Dependencies

| Form | Bounding box source | Override source |
| --- | --- | --- |
| SBD1 | `src/lib/empirePdf/boundingBoxes/sbd1.ts` | `src/lib/empirePdf/calibrationOverrides/sbd1.ts` |
| SBD4 | `src/lib/empirePdf/boundingBoxes/sbd4.ts` | None active |

`src/lib/empirePdf/boundingBoxes/index.ts` registers SBD1 and SBD4 and applies SBD1 calibration overrides at lookup time.

## Legacy or Parallel Generation Paths

| Path | Status | Risk |
| --- | --- | --- |
| `src/lib/pdf/tenderPack.ts` | Still imported by `TenderPackGeneratorPanel` for local validation | Uses older `sbd1AutoFill` and `sbd4AutoFill` flow |
| `src/app/api/tender-pack/generate/route.ts` | Active API route | Produces `generateSimplePack`, not SBD1/SBD4 pack |
| `src/lib/pdfs/empirePdfFill.ts` | Active in test-fill route | Has intelligent fill plus overlay fallback path |
| `src/app/api/sbd4/generate/route.ts` | Active standalone route | Uses direct SBD4 map and hard-coded defaults |
| `src/lib/pdf/sbd1-overlay/*` | Present | Older overlay path |
| `src/lib/pdf/sbd4-overlay/*` | Present | Older overlay path |
| `src/lib/pdf/empirePdfEngine.ts` | Present | Older SBD1 generation path |
| `src/lib/pdf/generateSBD4.ts` | Present | Older SBD4 generation path |

## Template Inventory

`public/templates` contains:

- `SBD1.pdf`
- `SBD3.pdf`
- `SBD4.pdf`
- `SBD6.pdf`

`src/lib/pdfs/templates/tender-packs` contains:

- `sbd1.pdf`
- `sbd4.pdf`
- `sbd4-8-9.pdf`
- `sbd6.pdf`
- `sbd8.pdf`
- `sbd9.pdf`
- `sbdforms.pdf`
- `standardconditionsoftender.pdf`
- `templateKey.pdf` with zero bytes

Registry entries exist but files were not present in `src/lib/pdfs/templates/tender-packs` during this audit:

- `sbd2.pdf`
- `sbd3.pdf`
- `sbd5.pdf`
- `sbd7.pdf`
- `annexures.pdf`
- `addendums.pdf`

## QA and Calibration Artifact Dependencies

The following artifact paths are referenced only by scripts:

- `output/pdf/empirepdf-qa`
- `output/pdf/sbd1-calibration-manual`
- `output/pdf/sbd1-signature-name-suppression-fix`
- `output/pdf/sbd4-calibration-manual`

No production route was found referencing these output artifact folders.

## Readiness Dependency Summary

Production pack generation currently depends on repo-local templates and source files, not the release packages. A production deployment should explicitly promote or copy the candidate SBD1/SBD4 artifacts into the active runtime template/source locations, or update the runtime resolver to use a controlled production artifact source. Until that alignment is done, the release packages are validated artifacts but not the active production source.

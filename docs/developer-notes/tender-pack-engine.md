# Tender Pack Engine

Date: 2026-06-11

## Renderer Architecture

The tender pack engine is implemented across the tender API routes and PDF libraries:

- `src/app/api/tender/generate/route.ts` orchestrates tender generation.
- `src/lib/empirePdf/*` contains the professionalized renderer, layout, template registry, semantic field mapping, and validation helpers.
- `src/lib/pdf/*` contains legacy and support PDF generation helpers.
- `public/templates/SBD1.pdf`, `SBD4.pdf`, `SBD6.pdf`, and related files are the source templates.

High-level flow:

```text
User action
  -> tender generation route
  -> authorize request
  -> load deal and contractor
  -> recalculate contractor compliance
  -> block if readiness/compliance state is not acceptable
  -> map contractor/deal fields into SBD templates
  -> render individual PDF sections
  -> merge tender pack
  -> persist tender pack metadata
  -> return generated pack response
```

## Compliance Logic

Compliance is recalculated before tender pack generation. The generation route reads the resulting fields without changing the scoring model:

- `readinessScore`
- `tenderLockStatus`
- `docsMissing`
- `missingDocumentTypes`
- `expiredDocumentCount`
- `complianceApproved`
- `legacyDocuments`
- `intelligence`

Tender generation blocks when:

- `complianceApproved` is not true.
- Required documents are missing.
- Documents are expired.
- `tenderLockStatus` is not `READY`.

This sprint does not modify compliance calculations or security rules.

## Readiness Logic

Readiness is treated as an input to workflow gates and tender output metadata. The generation route records readiness data into the response and tender pack state.

The readiness gate is:

```text
Compliance recalculation
  -> readiness score
  -> document gap analysis
  -> lock status
  -> generation allowed or blocked
```

Readiness calculations are intentionally left unchanged.

## AI Intelligence Mapping

The tender pack engine maps compliance intelligence into tender output and operations metadata:

- `riskGrade`
- `missingCriticalDocuments`
- `explainableSummary`
- `blockedReasons`
- `reviewRecommendations`
- `documentBreakdown`

This enables staff and managers to understand why a tender pack is blocked or approved for generation without manually inspecting every source document.

## Operational Notes

- Treat the original uploaded document and stored compliance result as source of truth.
- Do not bypass the readiness gate in production.
- Record generation evidence in release notes after each production release.
- If a generated PDF is visually incorrect, run the PDF QA scripts before modifying renderer coordinates.

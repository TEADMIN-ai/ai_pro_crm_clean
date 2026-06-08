# SBD1 Nomsa Dlamini Field Trace Report

Generated: 2026-05-31

## Executive Trace

`Nomsa Dlamini` follows this path into SBD1:

`EMPIRE_PDF_QA_SCENARIOS[0].profile.directorName`
-> `buildSemanticProfile(...).signatureName`
-> `resolveSemanticField(formId: "SBD1", fieldId: "signature_name")`
-> `renderTemplateField(...)`
-> `SBD1.signature_name`

## SBD1 Field Mapping

Relevant SBD1 template definition:

- File: `src/lib/empirePdf/templates/sbd1.ts`
- Field: `signature_name`
- Anchor text: `SIGNATURE OF BIDDER`
- Field type: `signature`
- Semantic key: `signatureName`

The SBD1 intelligent template does not define a `director_name` field. The person-name field in SBD1 is `signature_name`.

## Template Hydration Logic

Relevant hydration:

- File: `src/lib/empirePdf/semanticContext.ts`
- `signatureName` is hydrated as:

```ts
clean(profile.directorName) || clean(profile.contactPerson) || clean(profile.companyName)
```

For the baseline profile, this resolves to `Nomsa Dlamini` because `profile.directorName` is populated.

## Semantic Resolution Logic

Relevant resolver:

- File: `src/lib/empirePdf/semanticRegistry/resolveSemanticField.ts`
- `resolveSignatureName(...)` checks `directorName` first.

Priority:

| Priority | Property | Baseline value | Used? |
| ---: | --- | --- | --- |
| 1 | `directorName` | `Nomsa Dlamini` | yes |
| 2 | `contactPerson` | `Nomsa Dlamini` | no, fallback only |
| 3 | `companyName` | `Empire Civil Projects (Pty) Ltd` | no, fallback only |

Resolved source:

```json
{
  "fieldKey": "SBD1.signature_name",
  "semanticKey": "signatureName",
  "sourceField": "contractor.directorName",
  "value": "Nomsa Dlamini"
}
```

## Data Source Assignment

Baseline QA source:

- File: `src/lib/empirePdf/qa/scenarios.ts`
- Default profile values:
  - `directors: "Nomsa Dlamini"`
  - `contactPerson: "Nomsa Dlamini"`
  - `directorName: "Nomsa Dlamini"`

Because all three person-related properties contain the same name in the baseline profile, the visible value alone is ambiguous. The resolver trace removes that ambiguity: the selected source is `contractor.directorName`.

## Shared Field Identifiers And Semantic Keys

Shared or related identifiers:

| Form | Field ID | Semantic key | Notes |
| --- | --- | --- | --- |
| SBD1 | `signature_name` | `signatureName` | Renders `Nomsa Dlamini` in SBD1. |
| SBD4 | `director_name` | `signatureName` | Uses the same semantic value for bidder/representative name. |
| SBD4 | `signature_name` | `signatureName` | Same field ID as SBD1 and same semantic key. |
| SBD1/SBD4 | `company_name` | `companyName` | Shared field ID, but not the source of `Nomsa Dlamini`. |

## Additional Path Note

`src/lib/empirePdf/fillSbd1.ts` has a legacy fallback `contactPerson` field map, but the observed EmpirePDF QA/manual calibration path uses `fillTemplateWithIntelligence(...)`. In that intelligent path, `Nomsa Dlamini` is not rendered through a legacy `contactPerson` SBD1 field; it is rendered through `SBD1.signature_name`.

For merged tender-pack inputs, `src/lib/pdf/mergeTenderPack.ts` normalizes `directorName` from `contractor.directorName`, then `contractor.contactPerson`, then `contractor.contactName`. However, the current `fillSbd1` wrapper passes `contactPerson` and `directors` into the intelligent profile, not `directorName`; therefore live merged-pack behavior may fall back to `contactPerson` if `directorName` is absent in the profile passed to SBD1. That does not change the baseline QA finding above.

## Conclusion

`Nomsa Dlamini` originates from `directorName` in the baseline profile and is rendered in SBD1 by `SBD1.signature_name`.

It is not a coordinate, calibration override, or bounding-box issue.


# SBD1 Nomsa Dlamini Root Cause Summary

Generated: 2026-05-31

## Finding

`Nomsa Dlamini` is rendered by the EmpirePDF SBD1 field `SBD1.signature_name`.

It is not coming from an SBD4-only field. SBD1 has its own active `signature_name` template field, and that field uses the shared semantic key `signatureName`.

## Source

For the baseline QA/manual calibration profile, the value originates from:

- `profile.directorName`: `Nomsa Dlamini`
- `profile.contactPerson`: `Nomsa Dlamini`
- `profile.directors`: `Nomsa Dlamini`

The active semantic resolver chooses `contractor.directorName` first for `signatureName`, so the trace source is:

- SBD1 field: `SBD1.signature_name`
- Semantic key: `signatureName`
- Source property: `contractor.directorName`
- Rendered value: `Nomsa Dlamini`

## Why It Appears In SBD1

SBD1 defines `signature_name` as a signature field with `semanticKey: "signatureName"`.

The semantic registry maps `SBD1.signature_name` to `sourcePath: "semantic.signatureName"`.

`semantic.signatureName` is hydrated from the contractor profile using this priority:

1. `directorName`
2. `contactPerson`
3. `companyName`

The resolver also has a dedicated `resolveSignatureName` path that returns `contractor.directorName` when it is populated. In the baseline QA profile, `directorName` is `Nomsa Dlamini`, so that value is selected before contact person or company name.

## Shared SBD1/SBD4 Link

SBD1 and SBD4 share the `signatureName` semantic concept:

| Form field | Field ID | Semantic key | Source path |
| --- | --- | --- | --- |
| `SBD1.signature_name` | `signature_name` | `signatureName` | `semantic.signatureName` |
| `SBD4.director_name` | `director_name` | `signatureName` | `semantic.signatureName` |
| `SBD4.signature_name` | `signature_name` | `signatureName` | `semantic.signatureName` |

This is why the same person name can appear in both SBD1 and SBD4. The coupling is semantic, not coordinate-based.

## Not A Coordinate Or Calibration Issue

This investigation did not modify coordinates, calibration overrides, renderer logic, or bounding boxes.

The root cause is data/semantic mapping: SBD1's `signature_name` field is intentionally wired to `signatureName`, and `signatureName` resolves from `directorName` first.


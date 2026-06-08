# SBD1 Signature Name Suppression Fix Report

Generated: 2026-05-31T12:35:05.579Z

## Fix Applied

`SBD1.signature_name` is now suppressed in the intelligent fill path when all of the following are true:

- No calibrated `signature_name` bounding box exists.
- No high-confidence signature-specific anchor exists.
- No template metadata explicitly declares a valid signature section for the field.

The guard is scoped to `SBD1.signature_name` only. It does not apply to SBD4 or other templates.

## Before

Before trace: `SBD1.signature_name` rendered=true, source=contractor.directorName, anchor=NAME OF BIDDER, strategy=placement_anchor, x=29.32, y=390.01.

## After

After trace: `SBD1.signature_name` rendered=false, source=contractor.directorName, anchor=NAME OF BIDDER, strategy=not_rendered_suppressed, x=150.00, y=82.00.

## Verification

- Nomsa Dlamini removed from SBD1 supplier-information rendering: yes
- Existing calibrated fields unchanged: yes
- Calibrated fields compared: 13
- Calibrated fields unchanged: 13

## Generated Artifacts

- `before.pdf`
- `after.pdf`
- `root-cause-fix-report.md`

## Notes

No calibration overrides, SBD4 files, coordinates, or bounding-box definitions were modified.

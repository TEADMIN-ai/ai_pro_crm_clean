# SBD1 Targeted Coordinate Recalibration Report

Generated: 2026-05-30
Source of truth: generated debug PDF overlay screenshots.

## Artifacts
- Before full-page debug screenshot: `output/pdf/sbd1-recalibration/before-baseline-sbd1-debug-page1.png`
- After full-page debug screenshot: `output/pdf/sbd1-recalibration/after-baseline-sbd1-debug-page1.png`
- Before phone crop: `output/pdf/sbd1-recalibration/crops/before-phone-area.png`
- After phone crop: `output/pdf/sbd1-recalibration/crops/after-phone-area.png`
- Before target crop: `output/pdf/sbd1-recalibration/crops/before-target-area.png`
- After target crop: `output/pdf/sbd1-recalibration/crops/after-target-area.png`
- Regenerated normal PDF: `output/pdf/sbd1-recalibration/after-baseline-sbd1.pdf`
- Regenerated debug PDF: `output/pdf/sbd1-recalibration/after-baseline-sbd1.debug.pdf`

## Coordinate Changes

| Requested field | EmpirePDF field | Before box | After box | Delta | Result |
| --- | --- | --- | --- | --- | --- |
| telephoneNumber | SBD1.telephone | xMin 433.82, xMax 563.82, yMin 329.39, yMax 344.39 | xMin 433.82, xMax 563.82, yMin 359.03, yMax 374.03 | dx 0, dy +29.64 | Moved from the CELLPHONE NUMBER row into the TELEPHONE NUMBER row's visible number cell. |
| cellPhoneNumber | N/A | No standalone SBD1 cellphone bounding box is registered in EmpirePDF. | Unchanged | N/A | Not changed because adding a field would require template/registry/extraction changes outside scope. |
| bbbeeLevel | SBD1.bbbee_status | xMin 148, xMax 348, yMin 132, yMax 146 | xMin 148, xMax 292, yMin 148, yMax 162 | dx 0, dy +16, width -56 | Tightened and lifted away from the Yes/No labels in the B-BBEE certificate area. |
| bbbeeCheckbox | SBD1.supplier_type_pty_ltd | xMin 148, xMax 158, yMin 108, yMax 118 | Unchanged | dx 0, dy 0 | Current box already sits on the visible lower-left checkbox; attempted movement caused misalignment, so it was retained. |
| registrationNumber | SBD1.registration_number | xMin 144.02, xMax 567.09, yMin 269.94, yMax 284.62 | Unchanged | dx 0, dy 0 | Retained because the visible registration/VAT region is shared with VAT output; moving it caused text collision in the debug overlay. |
| submissionDate | SBD1.date | xMin 430, xMax 550, yMin 76, yMax 91 | Unchanged | dx 0, dy 0 | Retained because moving downward pushed the date farther out of frame; current box is the least-colliding calibrated position. |

## Regeneration Notes
- Full QA regeneration via `npm run pdf:qa` was attempted, but Windows reported EBUSY locks on `output/pdf/empirepdf-qa` files.
- Targeted SBD1 normal/debug PDFs were regenerated into `output/pdf/sbd1-recalibration` with the same EmpirePDF fill engine and `baseline_local_pty` QA profile.
- Targeted regeneration completed with 0 renderer warnings and 14 rendered fields.

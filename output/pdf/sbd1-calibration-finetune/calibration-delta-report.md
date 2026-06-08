# SBD1 Fine-Tuning Calibration Delta Report

Generated: 2026-05-30

## Scope

Baseline: latest grouped-calibration `after.pdf`.

Only `src/lib/empirePdf/calibrationOverrides/sbd1.ts` was updated. Renderer logic and core bounding box definitions were not modified.

## Artifacts

| Artifact | File |
| --- | --- |
| Before PDF | `before.pdf` |
| After PDF | `after.pdf` |
| Before overlay | `before-overlay.pdf` |
| After overlay | `after-overlay.pdf` |
| Before table | `before-calibration-table.csv` |
| After table | `after-calibration-table.csv` |

## Fine-Tune Deltas

| Field | Before X | Before Y | Before W | Before H | After X | After Y | After W | After H | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `telephone` | 433.82 | 357.03 | 130.00 | 15.00 | 433.82 | 359.03 | 130.00 | 15.00 | `dy +2` |
| `registration_number` | 144.02 | 265.94 | 423.07 | 14.68 | 144.02 | 263.94 | 423.07 | 14.68 | `dy -2` |
| `bbbee_status` | 148.00 | 142.00 | 144.00 | 14.00 | 148.00 | 140.00 | 144.00 | 14.00 | `dy -2` |
| `supplier_type_pty_ltd` | 148.00 | 116.00 | 10.00 | 10.00 | 148.00 | 112.00 | 10.00 | 10.00 | `dy -4` |
| `date` | 430.00 | 82.00 | 120.00 | 15.00 | 430.00 | 86.00 | 120.00 | 15.00 | `dy +4` |

## Override Changes

| Field | Before override | After override |
| --- | --- | --- |
| `telephone` | `dy: -2` | `dy: 0` |
| `registration_number` | `dy: -4` | `dy: -6` |
| `bbbee_status` | `dy: -6` | `dy: -8` |
| `supplier_type_pty_ltd` | `dy: 8` | `dy: 4` |
| `date` | `dy: 6` | `dy: 10` |

## Notes

This pass used small manual corrections only. Non-target fields were left at the latest baseline values.

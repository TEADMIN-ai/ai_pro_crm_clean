# Generated Pack Inventory

Generated: 2026-05-31

## Classification

FAIL

## Summary

No tender pack was generated during this activation test.

The test was blocked at the CRM login screen before the `Generate Tender Pack` button could be reached. Because the test restrictions required using the normal UI and not bypassing the UI, no direct API call was made to `/api/tender-pack/generate`.

## Generated Artifacts

| Artifact | Value |
| --- | --- |
| API route reached | No |
| `packId` | Not generated |
| `downloadURL` | Not generated |
| Firebase Storage path | Not generated |
| Firestore `tenderPacks` document | Not generated |
| Local PDF artifact | Not generated |

## SBD Status

| Document | Runtime Status |
| --- | --- |
| SBD1 | Not generated |
| SBD4 | Not generated |
| Summary PDF | Not generated |
| Merged tender pack | Not generated |

## Inventory Result

No generated PDF artifact paths are available for this run.

## Reason

Authentication failed before the normal CRM workflow reached Tender Intake or the Generate Tender Pack UI action.

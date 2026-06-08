# EmpirePDF Activation Test Report

Generated: 2026-05-31

## Classification

FAIL

## Test Setup

Feature flag requested:

```text
EMPIREPDF_GENERATION_ENABLED=true
```

Development server:

- Started with the feature flag set in the server process environment.
- Next.js reported ready at `http://localhost:3000`.
- Environment file loaded by Next.js: `.env.local`.

## Required Flow

Contractor/Test Data -> Tender Intake -> Generate Tender Pack Button -> `/api/tender-pack/generate` -> `generateMergedPack()`

## Actual Flow Reached

1. Browser opened `http://localhost:3000`.
2. App redirected to `http://localhost:3000/login`.
3. Login form rendered.
4. No existing authenticated CRM session was present.
5. No explicit CRM test credentials were found in local docs or env variable names.
6. One locally configured email/password pair was tried through the visible login UI.
7. Firebase rejected the login with `auth/invalid-credential`.

The test did not reach Tender Intake, the `Generate Tender Pack` button, `/api/tender-pack/generate`, or `generateMergedPack()`.

## Captured API Response

Not captured.

Reason: the test was blocked by authentication before the normal CRM workflow could reach the tender-pack generation action. The API was not called directly because this test explicitly required not bypassing the UI.

## Requested Response Fields

| Field | Captured Value |
| --- | --- |
| `success` | Not captured |
| `packId` | Not captured |
| `downloadURL` | Not captured |
| `warnings` | Not captured |
| `missingFields` | Not captured |

## Generation Status

| Item | Status |
| --- | --- |
| `/api/tender-pack/generate` reached through UI | No |
| `generateMergedPack()` executed | Not verified at runtime |
| SBD1 generation status | Not reached |
| SBD4 generation status | Not reached |
| PDF persisted to Firebase Storage | Not reached |
| Firestore `tenderPacks` record created | Not reached |

## Verification Results

| Verification | Result | Notes |
| --- | --- | --- |
| Existing JSON response contract remains unchanged | Not runtime-verified | Static implementation preserves the response shape, but UI runtime did not reach the route. |
| Frontend remains functional | PASS WITH WARNINGS | Login page rendered, but authenticated workflow was unavailable. |
| No Firebase errors | FAIL | Firebase authentication returned `auth/invalid-credential` for the attempted UI login. |
| No Firestore errors | Not reached | No Firestore-backed workflow was reached. |
| No authentication errors | FAIL | Authentication blocked the test. |
| No contractor workflow regressions | Not reached | Contractor workflow was not accessible without login. |
| SBD1 Production Candidate appears in output | Not reached | No output was generated. |
| SBD4 Production Candidate appears in output | Not reached | No output was generated. |

## Root Cause

The controlled end-to-end activation test could not be completed because the normal CRM UI workflow requires a valid authenticated user session, and no valid test credentials were available in the local environment or documentation found during this run.

## Rollback Confirmation

Rollback path remains:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

Because the feature flag defaults to disabled unless explicitly set to `true`, `1`, or `yes`, removing the flag also rolls the route back to `generateSimplePack()`.

## Required Next Action

Provide a valid CRM test user with a role allowed to generate tender packs, or start the test in a browser profile that already has a valid authenticated session. Then rerun the same UI path without changing code.

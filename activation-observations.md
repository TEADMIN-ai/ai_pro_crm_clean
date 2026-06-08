# EmpirePDF Activation Observations

Generated: 2026-05-31

## Classification

FAIL

## Observations

1. The dev server was started with `EMPIREPDF_GENERATION_ENABLED=true`.
2. The app loaded at `http://localhost:3000`.
3. The browser was redirected to `/login`.
4. The login screen rendered correctly.
5. There was no existing authenticated browser session.
6. Local docs and env variable names did not expose a dedicated CRM test account.
7. A locally configured email/password pair was tried through the UI and rejected by Firebase.
8. The test did not reach Tender Intake, contractor data, the tender-pack button, or the generation route.
9. No Firebase Storage write was attempted.
10. No Firestore tender-pack record creation was attempted.

## Response Contract Observation

The route implementation still preserves the existing JSON response contract, but this was not verified through runtime UI execution because authentication blocked the test before generation.

Expected JSON fields remain:

- `success`
- `base64`
- `packId`
- `downloadURL`
- `missingFields`
- `warnings`

## Rollback Observation

Rollback remains configuration-only:

```text
EMPIREPDF_GENERATION_ENABLED=false
```

The route defaults to the legacy simple-pack generator when the flag is missing or false.

## Risk Notes

- The activation feature flag itself is in place, but production validation still requires a successful authenticated UI run.
- The test did not provide evidence that SBD1/SBD4 candidate content appears in generated output.
- The test did not provide evidence that Firebase Storage and Firestore persistence succeed under the enabled flag.
- The test did not reveal contractor workflow regressions because contractor workflow was not reached.

## Recommendation

Rerun the activation test with a valid privileged CRM account and a known ready contractor/deal. The next run should capture:

- Browser route and button interaction.
- `/api/tender-pack/generate` JSON response.
- `packId`.
- `downloadURL`.
- persisted artifact metadata.
- downloaded PDF page inventory.
- confirmation that SBD1 and SBD4 are present in the merged output.

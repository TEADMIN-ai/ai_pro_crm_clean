# Deployment Runbook

## Git Workflow

```text
Create scoped changes
  -> npm run typecheck
  -> run targeted tests when available
  -> review git diff
  -> commit to feature branch or main according to release policy
  -> push
  -> Vercel preview/prod deployment
  -> production validation
```

## Branch Strategy

- `main` tracks production-ready code.
- Short-lived feature branches should be used for risky work.
- Documentation-only changes may be merged after review and typecheck.
- Do not merge changes that alter readiness, compliance, security rules, or authorization without explicit approval.

## Vercel Deployment Process

1. Confirm environment variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_STORAGE_BUCKET` or `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
2. Run `npm run typecheck`.
3. Run `npm run build` before production promotion when environment variables are available.
4. Deploy through Vercel connected Git or Vercel CLI.
5. Confirm deployment uses the intended branch and commit.

## Production Validation Checklist

- Login as Admin.
- Login as Manager.
- Login as Staff.
- Create a test contractor as Admin.
- Create a test contractor as Manager.
- Confirm Firebase Auth user exists.
- Confirm `users/{uid}` exists.
- Confirm `contractors/{uid}` exists.
- Confirm contractor custom claims include `role: contractor` and `contractorId`.
- Confirm onboarding email receipt.
- Confirm `EMAIL_SEND_SUCCESS` or documented `EMAIL_SEND_FAILURE`.
- Confirm onboarding link opens.
- Confirm contractor password setup.
- Confirm contractor login.
- Create a deal note.
- Refresh the deal page and confirm note persists.
- Confirm `DEAL_NOTE_CREATED` in `auditLogs`.
- Generate or validate tender pack workflow for an eligible contractor.

## Rollback Procedure

```text
Detect production issue
  -> Stop further promotion
  -> Identify bad deployment in Vercel
  -> Promote previous known-good deployment
  -> Validate login and core workflows
  -> Preserve logs and evidence
  -> Patch root cause on a new branch
```

Rollback rules:

- Do not manually edit production data unless approved.
- Do not change Firebase rules during emergency rollback unless the incident is rule-related and approved.
- Keep the failed deployment URL and logs for post-incident review.

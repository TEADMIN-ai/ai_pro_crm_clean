# Release Candidate 1

Date: 2026-06-11

## Features Delivered

- Production authentication and session creation.
- Firebase Admin initialization and credential normalization.
- Contractor creation for Admin and Manager workflows.
- Contractor onboarding link generation.
- Contractor record and user profile creation.
- Contractor role custom claims.
- Contractor onboarding email dispatch through Resend.
- Failure-tolerant email delivery with admin/manual recovery link surfacing.
- Deal notes persistence and reload flow.
- `DEAL_NOTE_CREATED` audit logging.
- Tender pack generation and professionalized PDF rendering.
- Developer knowledge base and operations runbooks.

## Bugs Fixed

- Firebase private key newline handling.
- Session creation reliability after Firebase Admin configuration.
- `/api/me` profile lookup observability and failure reporting.
- Contractor onboarding email no longer blocks contractor creation on delivery failure.

## Validation Results

Local validation completed:

- `npm run typecheck` passed on 2026-06-11.
- Static route audit confirms `POST /api/contractors` creates Firebase Auth user, Firestore contractor record, Firestore user record, custom claims, onboarding link, and email attempt.
- Static route audit confirms contractor creation response includes `contractorCreated`, `onboardingLinkGenerated`, and `emailSent`.
- Static route audit confirms `EMAIL_SEND_START`, `EMAIL_SEND_SUCCESS`, and `EMAIL_SEND_FAILURE` logs.
- Static route audit confirms deal notes persist to `dealNotes` and write `DEAL_NOTE_CREATED` audit logs.

Production validation still required:

- Create test contractor.
- Verify onboarding email received.
- Verify onboarding link opens.
- Verify password setup.
- Verify contractor login.
- Verify Admin and Manager contractor creation paths separately.

## Deployment History

- Active local branch: `main`.
- Remote: `origin/main`.
- Production hosting: Vercel.
- Production URL: TODO - record active Vercel URL after validation.

## Rollback Steps

1. Identify the failing Vercel deployment.
2. Promote the previous known-good Vercel deployment.
3. Confirm Admin login, Manager login, contractor list, and tender pack route health.
4. Preserve logs for contractor creation, email dispatch, and auth routes.
5. Patch root cause on a new branch and redeploy.

## Release Recommendation

Controlled GO after live email/password/login validation is captured. Until then, operate with manager/admin manual onboarding recovery using the returned onboarding link.

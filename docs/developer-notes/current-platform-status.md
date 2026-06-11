# Current Platform Status

Date: 2026-06-11

## System Overview

Torque Empire AI Pro CRM is a Next.js 16 / React 18 application backed by Firebase Auth, Firestore, Firebase Storage, and Firebase Admin SDK. The platform supports role-based dashboards for admin, manager, staff, contractor, auditor, and viewer users.

Core workflows currently present in the codebase:

- Firebase login and server session creation through `/api/auth/login`.
- Authenticated profile resolution through `/api/me`.
- Contractor onboarding and contractor file management through `/api/contractors`.
- Contractor document upload, document execution, compliance recalculation, and staff review.
- Deal management, deal notes, tender readiness checks, and tender pack generation.
- Tender pack rendering with SBD templates, compliance state, readiness state, and AI intelligence metadata.
- Audit logging through the `auditLogs` collection.
- Contractor onboarding email delivery through Resend from the contractor creation route.

## Current Readiness Score

Overall Platform Readiness Score: 86/100.

Rationale:

- Authentication, session creation, Firebase Admin, contractor creation, contractor onboarding, tender pack generation, and tender pack professionalisation are implemented.
- Deal notes are implemented and typechecked, including `DEAL_NOTE_CREATED` audit logging.
- Contractor onboarding email dispatch is implemented with failure-tolerant behavior and admin recovery link surfacing.
- Remaining production risk is live email receipt/password/login validation, plus operational evidence capture in production.

## Completed Milestones

- Authentication operational.
- Session cookie creation operational.
- Firebase Admin initialized with service account credentials or application default credentials.
- `FIREBASE_PRIVATE_KEY` newline normalization implemented.
- Contractor creation creates Firebase Auth user, `users/{uid}`, `contractors/{uid}`, contractor custom claims, and contractor linkage.
- Onboarding link generation uses Firebase password reset link generation.
- Onboarding link is persisted on the contractor record.
- Contractor onboarding email dispatch uses Resend with `EMAIL_SEND_START`, `EMAIL_SEND_SUCCESS`, and `EMAIL_SEND_FAILURE` logs.
- Contractor creation returns `contractorCreated`, `onboardingLinkGenerated`, and `emailSent`.
- Email failure does not block contractor creation.
- Admin/Manager contractor page surfaces the onboarding link for manual recovery.
- Deal notes save to Firestore and reload after save.
- Deal note creation records `DEAL_NOTE_CREATED` in `auditLogs`.
- Tender pack generation recalculates contractor compliance before generation.
- Tender pack output includes readiness, compliance, blocked reasons, review recommendations, and document breakdown metadata.

## Outstanding Risks

- Resend production delivery must be verified with a real recipient mailbox.
- Password reset/onboarding link must be tested end-to-end in production after email receipt.
- Contractor login after password setup must be verified in production.
- Email sender domain and `RESEND_FROM_EMAIL` should be verified in Resend to reduce deliverability risk.
- `/api/tender/email` still reports email readiness rather than confirmed SMTP/Resend delivery for tender pack emails.
- Production validation evidence should be retained after each release candidate.
- Firestore indexes should be monitored for any query failures under production data volume.

## Active Branches

- Local branch: `main`.
- Remote tracking branch: `origin/main`.
- Remote repository: `https://github.com/TEADMIN-ai/ai_pro_crm_clean.git`.

## Production URLs

The repo documentation confirms Vercel deployment, but no canonical production URL is stored in tracked files. Record the active Vercel URL here after production validation:

- Production application: TODO - Vercel production URL.
- Firebase project: configured through `FIREBASE_PROJECT_ID`.
- Resend sender/domain: configured through `RESEND_FROM_EMAIL` and Resend dashboard.

## Latest Local Validation

- `npm run typecheck` passed on 2026-06-11.
- Static code audit confirms contractor creation generates and returns an onboarding link.
- Static code audit confirms Resend initialization is present in `src/lib/email/contractorOnboardingEmail.ts`.
- Static code audit confirms deal notes write `DEAL_NOTE_CREATED` audit logs.

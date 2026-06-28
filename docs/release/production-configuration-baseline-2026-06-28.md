# Torque Empire Production Configuration Baseline and RC1 Evidence Pack

Date: 2026-06-28  
Scope: Torque Empire AI Platform production baseline, deployment drift audit, Firebase/Vercel configuration evidence, and RC1 evidence readiness.

## Executive Summary

Production is now serving the validated persistence commit `f3c185b7899183f5340a2ae23fd48eabddbf2609` through Vercel production deployment `dpl_HGWmc3kcbL9eomStZyipHiZr16Lh`.

The deployment mismatch that previously had production serving `aef15a0b38409d9d662bb68af9a7ea1afffa41d3` has been corrected by pushing local `main` to the remote production branch. Vercel now reports production branch `main`, target `production`, state `READY`, and the expected Git SHA.

The production baseline is not yet clean enough for RC1 sign-off. The audit found release-blocking configuration drift between the repository Firebase project and the runtime Firebase project. The live runtime Firebase project has no Firestore composite indexes while the repository default Firebase project contains the expected indexes. The runtime Firebase project also contains failed legacy Cloud Functions. Document-level Firestore, Authentication, Storage, and authenticated RC1 workflow evidence could not be fully established from this workstation.

Final status: RED - Production Configuration Inconsistent.

## Production Configuration Baseline

| Area | Baseline |
| --- | --- |
| Vercel project | `ai-pro-crm-clean` |
| Vercel project ID | `prj_KKyLEBVHEJUKEdfWgD3CmtQjop0z` |
| Production deployment | `dpl_HGWmc3kcbL9eomStZyipHiZr16Lh` |
| Production URL | `https://ai-pro-crm-clean.vercel.app` |
| Deployment URL | `https://ai-pro-crm-clean-4hy7d3w4n-chadwin-s-projects.vercel.app` |
| Production Git SHA | `f3c185b7899183f5340a2ae23fd48eabddbf2609` |
| Production branch | `main` |
| Framework | Next.js |
| Vercel Node version | `24.x` |
| Repository HEAD | `f3c185b7899183f5340a2ae23fd48eabddbf2609` |
| App package | `ai_pro_crm@1.0.0` |
| Next.js | `^16.1.6` |
| Firebase client SDK | `^10.12.0` |
| Firebase Admin SDK | `^13.6.1` |
| OpenAI SDK | `^6.22.0` |
| Email providers in package | `resend`, `nodemailer` |
| Scheduled Vercel route | `/api/vehicle-finance/inventory-sync` at `0 4 * * *` |

## Infrastructure Diagram

```text
GitHub main
  -> Vercel project ai-pro-crm-clean
     -> Next.js application and API routes
        -> Firebase Auth
        -> Firestore
        -> Firebase Storage
        -> Firebase Cloud Functions
        -> Resend / Nodemailer email services
        -> OpenAI document and tender models
```

## Environment Matrix

Secret values were not exported or recorded.

| Variable | Local | Vercel Production | Vercel Preview | Vercel Development | Status |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Present | Present | Present | Present | Aligned by name |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Present | Present | Present | Present | Aligned by name |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Present | Present | Present | Present | Aligned by name, value not exposed |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Present | Present | Present | Present | Aligned by name, value not exposed |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Present | Present | Present | Present | Aligned by name |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Present | Present | Present | Present | Aligned by name |
| `FIREBASE_STORAGE_BUCKET` | Present | Present | Present | Present | Aligned by name, value not exposed |
| `FIREBASE_PRIVATE_KEY` | Present | Present | Present | Present | Aligned by name |
| `RESEND_API_KEY` | Present | Present | Present | Not listed | Expected production/preview only |
| `OPENAI_API_KEY` | Present | Present | Present | Present | Aligned by name |
| `OPENAI_DOCUMENT_MODEL` | Present | Present | Present | Present | Aligned by name |
| `FIREBASE_PROJECT_ID` | Missing locally | Present | Present | Present | Drift |
| `FIREBASE_CLIENT_EMAIL` | Missing locally | Present | Present | Present | Drift |
| `OPENAI_TENDER_MODEL` | Missing locally | Present | Present | Present | Drift |
| `NEXT_PUBLIC_DOLIBARR_API_URL` | Missing locally | Present | Present | Present | Drift |
| `EMAIL_USER` | Present locally | Not listed | Not listed | Not listed | Local-only legacy variable |
| `EMAIL_PASS` | Present locally | Not listed | Not listed | Not listed | Local-only legacy variable |
| `GOOGLE_APPLICATION_CREDENTIALS` | Present locally | Not listed | Not listed | Not listed | Local-only workstation credential |

## Vercel Summary

- Production is deployed and ready.
- Production branch is `main`.
- Production alias includes `ai-pro-crm-clean.vercel.app`.
- Deployment protection evidence shows SSO protection configuration in the Vercel project metadata, with fork protection enabled.
- Rollback candidates are available in recent production deployment history.
- Vercel domains visible in the account include `torqueempire.org` and `torqueempire.co.za`; the captured production alias for this project is the Vercel subdomain.
- Last captured Vercel runtime log sample did not include an actionable HTTP 500 stack trace. The log artifact contains a governance route invocation despite the error-level request.

Evidence files:

- `output/production-baseline/2026-06-28/vercel-deployment-summary.json`
- `output/production-baseline/2026-06-28/vercel-deployment-raw.json`
- `output/production-baseline/2026-06-28/vercel-env-ls.txt`
- `output/production-baseline/2026-06-28/vercel-production-deployments.txt`
- `output/production-baseline/2026-06-28/vercel-error-logs-1h.txt`

## Firebase Summary

Two active Firebase projects are visible:

| Project | Role observed | Risk |
| --- | --- | --- |
| `torque-empire-ai-pro-crm` | Runtime project used by live Firebase functions and production app configuration evidence | Must be treated as active production until formally disproven |
| `torque-empire-crm-prod` | Repository `.firebaserc` default project | Deployment target drift risk |

Firestore database evidence for `torque-empire-ai-pro-crm`:

- Database: `(default)`
- Location: `africa-south1`
- Mode: Firestore Native
- Concurrency: Pessimistic
- Point-in-time recovery: enabled
- Delete protection: disabled

Index evidence:

- Runtime project `torque-empire-ai-pro-crm`: no composite indexes returned.
- Repository default project `torque-empire-crm-prod`: five `deals` composite indexes returned.
- Repository file `firestore.indexes.json`: five `deals` composite indexes.

Cloud Functions evidence for `torque-empire-ai-pro-crm`:

| Function | Region | Runtime | State | Notes |
| --- | --- | --- | --- | --- |
| `onContractorDocumentCreated` | `africa-south1` | `nodejs20` | Active | Firestore document write trigger |
| `cleanupUserFromFirestore` | `us-central1` | `nodejs20` | Active | Auth delete trigger |
| `syncUserToFirestore` | `us-central1` | `nodejs20` | Active | Auth create trigger |
| `api` | `us-central1` | `nodejs18` | Failed | Legacy/failed function requiring disposition |
| `onUserCreate` | `us-central1` | `nodejs18` | Failed | Legacy/failed function requiring disposition |

Evidence files:

- `output/production-baseline/2026-06-28/firebase-projects.json`
- `output/production-baseline/2026-06-28/firebase-firestore-databases-live.json`
- `output/production-baseline/2026-06-28/firebase-firestore-indexes-live.json`
- `output/production-baseline/2026-06-28/firebase-firestore-indexes-repo-default-project.json`
- `output/production-baseline/2026-06-28/firebase-functions-live.json`
- `output/production-baseline/2026-06-28/firebase-functions-repo-default-project.json`
- `output/production-baseline/2026-06-28/firestore.rules`
- `output/production-baseline/2026-06-28/storage.rules`

## Security Summary

- Firestore rules and Storage rules snapshots were captured.
- Storage rules intentionally deny most direct client paths except privileged deal file access and hygiene-specific paths.
- Firestore rules cover core deal, contractor, document, tender, inventory, governance, and hygiene paths.
- Several server-side collections used by API routes are not explicitly represented in Firestore rules. This can be correct if all access is through Admin SDK API routes, but it must be documented as an intentional architecture decision.
- Authentication provider and custom-claim consistency could not be fully verified from exported document evidence in this run.

## Deployment Summary

Deployment is corrected but not fully release-certified.

| Check | Result |
| --- | --- |
| Repository HEAD equals production SHA | Pass |
| Production Vercel deployment ready | Pass |
| Production branch is `main` | Pass |
| Vercel environment names captured | Pass |
| Firebase project identity consistent across repo and runtime | Fail |
| Runtime Firestore indexes match repository | Fail |
| Failed Firebase Functions absent | Fail |
| Authenticated RC1 workflow evidence complete | Fail |
| Firestore/Auth/Storage document-level integrity fully audited | Fail |

## Configuration Drift Report

| Severity | Expected | Actual | Impact | Recommended action |
| --- | --- | --- | --- | --- |
| Critical | One canonical production Firebase project across repository, Vercel, rules, indexes, and operations | `.firebaserc` defaults to `torque-empire-crm-prod`; live runtime evidence points to `torque-empire-ai-pro-crm` | Rules/index deployments can target the wrong project; production audits can produce false confidence | Select canonical production project, align `.firebaserc`, Vercel env vars, Firebase CLI commands, and release docs |
| Critical | Runtime Firestore indexes match repository baseline | Runtime project returned no composite indexes; repo default project has the five expected indexes | Production queries may fail under real traffic | Deploy `firestore.indexes.json` to the actual runtime project or switch runtime env to the indexed project |
| High | No failed production Cloud Functions | Runtime project has failed `api` and `onUserCreate` functions | Legacy failed functions can confuse incident response and may indicate stale infrastructure | Confirm if obsolete, then delete or redeploy with documented owner |
| High | Firestore delete protection enabled or explicit backup policy documented | Runtime database delete protection is disabled | Accidental deletion risk | Enable delete protection or document approved backup/restore controls |
| High | RC1 evidence covers all required roles and workflows | Authenticated role/workflow evidence is incomplete | Cannot certify client onboarding readiness | Complete browser E2E against production with evidence screenshots and application IDs |
| High | Auth, Firestore, and Storage references fully reconciled | Document-level export and comparison did not complete from this workstation | Orphans, broken references, or schema drift may remain hidden | Run controlled Firebase Admin integrity audit from approved network/GCP environment |
| Medium | Local, preview, development, and production env names intentionally aligned | Local env has missing Vercel names and legacy-only email/credential names | Local reproduction may differ from deployment | Update `.env.example` and release checklist with required names per environment |
| Medium | No temporary QA users or documents remain from production validation | Timed-out prior E2E may have created `prod-f3c185b-*` QA accounts/documents | Test data can pollute operational reporting or auth surfaces | Search, disable, and document cleanup of temporary production QA accounts and records |

## RC1 Evidence Pack

Completed evidence:

- Production SHA verified as `f3c185b7899183f5340a2ae23fd48eabddbf2609`.
- Vercel deployment, aliases, branch, Node version, build environment names, cron path, and rollback history captured.
- Firebase project list captured.
- Firestore database metadata captured for runtime project.
- Firestore indexes captured for runtime and repository-default projects.
- Firebase Functions inventory captured for runtime project.
- Firestore rules, Storage rules, Firebase config, and repository indexes captured.
- Dependency baseline captured.
- Repository data surface search captured.
- Local `npm.cmd run typecheck` passed.
- Local `npm.cmd run route:integrity` passed.
- Local `npm.cmd run sanity` passed. The sanity output includes expected unauthorized-path checks and exited successfully.

Incomplete evidence:

- Admin login screenshot/evidence.
- Manager login screenshot/evidence.
- Staff login screenshot/evidence.
- Driver login screenshot/evidence.
- Contractor login screenshot/evidence.
- Roar Cars staff login screenshot/evidence.
- Vehicle Finance workflow persistence evidence.
- Contractor workflow evidence.
- Tender Pack workflow evidence.
- Hygiene workflow evidence.
- Production document upload and download evidence.
- Timeline, audit log, and decision log IDs from fresh production E2E.
- Storage reference reconciliation.
- Auth custom-claim to Firestore role reconciliation.
- Firestore schema drift scan across all collections.

## Recovery Actions

1. Decide the canonical production Firebase project and record it in release governance.
2. Align `.firebaserc`, Vercel Firebase environment variables, Firebase rules deployment commands, index deployment commands, and operational runbooks to the canonical project.
3. Deploy or reconcile Firestore composite indexes on the actual runtime project.
4. Resolve failed Cloud Functions `api` and `onUserCreate`: delete if obsolete, or redeploy if still required.
5. Enable Firestore delete protection or approve a documented backup/restore control.
6. Run a full Firebase Admin integrity audit from an approved environment with access to Firestore, Auth, and Storage.
7. Search for and clean up temporary production QA users/documents created during interrupted validation attempts.
8. Re-run authenticated production E2E for all RC1 roles and workflows.
9. Attach screenshots, application IDs, document IDs, timeline IDs, audit IDs, and storage paths to the next evidence pack.
10. Make this baseline a required deployment gate: no production deployment is complete unless it matches the approved baseline or has documented deviations.

## Business Impact

The core deployment mismatch has been corrected, reducing immediate risk for the Vehicle Finance persistence incident. However, project/index drift and incomplete Firebase/Auth/Storage evidence leave production exposed to configuration-specific failures that repository validation cannot catch. Client onboarding should remain blocked until the critical drift items are resolved and authenticated RC1 evidence is complete.

## Technical Recommendations

- Treat Firebase project identity as a release-blocking configuration item.
- Add a production preflight script that verifies Vercel Git SHA, Firebase project ID, Firestore indexes, rules timestamps, function states, and required env names before sign-off.
- Add a machine-readable baseline comparison command to CI/release operations.
- Keep all Firebase rules and index deployments explicitly project-scoped.
- Maintain production E2E credentials and test data lifecycle procedures with cleanup evidence.

## Artifact Index

Machine-readable and raw evidence is stored under:

`output/production-baseline/2026-06-28/`

Primary artifacts:

- `baseline-summary.json`
- `configuration-drift.json`
- `rc1-evidence-status.json`
- `vercel-deployment-summary.json`
- `firebase-projects.json`
- `firebase-firestore-databases-live.json`
- `firebase-firestore-indexes-live.json`
- `firebase-firestore-indexes-repo-default-project.json`
- `firebase-functions-live.json`
- `vercel-env-ls.txt`
- `local-env-names.txt`
- `application-baseline.json`
- `repository-data-surface.txt`
- `npm-typecheck.txt`
- `npm-route-integrity.txt`
- `npm-sanity.txt`

## Final Status

RED

Production Configuration Inconsistent

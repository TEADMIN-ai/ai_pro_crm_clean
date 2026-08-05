# TEOS Staging Runbook

## Purpose

TEOS staging exists to verify RFQ extraction, contractor assignment, document handling, and dashboard workflows without touching production Auth, Firestore, or Storage data.

## Firebase Project

Create a separate Firebase project named `torque-empire-ai-pro-crm-staging`.

Required separation:

- Firebase project ID: `torque-empire-ai-pro-crm-staging`
- Dedicated Firebase Auth users
- Dedicated Firestore database
- Dedicated Storage bucket
- Dedicated service account credentials
- Dedicated Firebase Admin configuration
- Dedicated public Firebase web app configuration

Do not copy production service-account credentials into staging or Preview.

## Firebase Setup

1. Create the Firebase project.
2. Register a separate Firebase web app for the staging deployment.
3. Enable the same Auth providers needed for TEOS UAT.
4. Create only synthetic staging users.
5. Enable Firestore.
6. Enable Storage.
7. Create a staging-only service account.
8. Store the staging private key only in the Vercel Preview environment.
9. Do not export or clone production personal data into staging.

## Vercel Preview Variables

Preview must use staging values only:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
```

Production variables must remain unchanged and must continue to point to `torque-empire-ai-pro-crm`.

## Environment Verification

Run before browser UAT:

```powershell
npx tsx scripts/staging/verifyStagingEnvironment.ts
```

The script prints only non-secret diagnostics:

- deployment environment
- Firebase project ID
- public/Admin project ID agreement
- Storage bucket name
- staging or production classification
- pass/fail result

It must never print private keys, service-account JSON, API tokens, or user credentials.

## Safety Guard

Server-side Firebase use is guarded by `src/lib/server/environmentSafety.ts`.

The guard rejects:

- Preview deployments using `torque-empire-ai-pro-crm`
- Production deployments using `torque-empire-ai-pro-crm-staging`
- protected writes without server Firebase project identity
- protected writes without deployment environment identity
- public/Admin project ID mismatch
- development using production Firebase without `TEOS_ALLOW_DEVELOPMENT_PRODUCTION_FIREBASE=allow-development-production-firebase`

## Synthetic Data Rules

Seed only synthetic records:

- one authorised admin test user
- one staff test user
- one canonical test contractor
- one deliberately unresolved contractor for negative tests
- synthetic compliance documents
- synthetic RFQs

Never seed real client, contractor, staff, supplier, document, financial, or personal data.

## Seed and Reset

Seed/reset scripts are intentionally not part of the first safety implementation. When added, they must:

- target only `torque-empire-ai-pro-crm-staging`
- fail if any production Firebase project ID is detected
- print dry-run summaries before mutation
- avoid production exports
- be idempotent
- record seed version and timestamp

## Browser UAT Sequence

1. Confirm Preview deployment URL is not production.
2. Confirm environment verification passes.
3. Sign in with an authorised staging admin or staff user.
4. Upload RFQ A and confirm extraction.
5. Upload RFQ B and confirm RFQ A fields and assignment are cleared.
6. Confirm latest filename, extraction ID, and extraction status display.
7. Open the created opportunity.
8. Assign a synthetic safe test contractor.
9. Confirm the assignment POST has an Authorization bearer token.
10. Confirm no 401 or 403 occurs for an authorised actor.
11. Confirm contractor count becomes 1.
12. Confirm business name, contractor ID, assigned by, and assigned date display.
13. Refresh the page.
14. Confirm assignment persists after reload.
15. Confirm Tax and CSD status use the assigned contractor evidence.
16. Confirm repeated assignment is idempotent and does not corrupt activity.

## Rollback

If staging is misconfigured:

1. Stop UAT immediately.
2. Remove the Preview deployment from active testing.
3. Rotate any exposed staging service-account key.
4. Remove incorrect Preview environment variables.
5. Re-run environment verification before retrying.

If production credentials are found in Preview:

1. Remove them from Preview.
2. Rotate the affected production service account.
3. Review Vercel deployment logs for any accidental protected write attempts.
4. Document findings before resuming staging setup.

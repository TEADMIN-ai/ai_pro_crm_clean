# TEOS Staging Runbook

## Purpose

TEOS staging exists to verify RFQ extraction, contractor assignment, document handling, and dashboard workflows without touching production Auth, Firestore, or Storage data.

## Firebase Project

Create a separate Firebase project named `torque-empire-teos-staging`.

Required separation:

- Firebase project ID: `torque-empire-teos-staging`
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

## Staging Service Account

Create and handle the staging Admin credential through Firebase Console only:

1. Open Firebase Console.
2. Select project `torque-empire-teos-staging`.
3. Open Project settings.
4. Open Service accounts.
5. Confirm the selected project is the staging project, not production.
6. Click Generate new private key.
7. Download the JSON key only long enough to copy values into Vercel Preview environment variables.
8. Store values only in the Vercel Preview environment.
9. Convert the multiline private key for Vercel by replacing actual line breaks with escaped `\n` sequences. Keep the BEGIN/END PRIVATE KEY markers intact.
10. Never commit the JSON key, a copied service-account JSON object, private key text, API keys, tokens, or credentials.
11. After Vercel Preview values are confirmed, delete the locally downloaded JSON key.
12. If the JSON key or private key is exposed, revoke the service-account key in Firebase Console immediately, generate a new staging key, and replace the Vercel Preview value.

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
TEOS_ENVIRONMENT
```

Production variables must remain unchanged and must continue to point to `torque-empire-ai-pro-crm`.

Use `.env.staging.example` as the name-only template. It contains placeholders only and must not be filled with real values in the repository.

## Vercel Preview Configuration

Do not run these commands until Mr K is ready to paste the staging values directly into the Vercel CLI prompts. Each command targets Preview only and does not deploy.

```powershell
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY preview
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN preview
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID preview
npx vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET preview
npx vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID preview
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID preview
npx vercel env add FIREBASE_PROJECT_ID preview
npx vercel env add FIREBASE_CLIENT_EMAIL preview
npx vercel env add FIREBASE_PRIVATE_KEY preview
npx vercel env add FIREBASE_STORAGE_BUCKET preview
npx vercel env add TEOS_ENVIRONMENT preview
```

Required Preview values:

```text
NEXT_PUBLIC_FIREBASE_PROJECT_ID=torque-empire-teos-staging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=torque-empire-teos-staging.firebasestorage.app
FIREBASE_PROJECT_ID=torque-empire-teos-staging
FIREBASE_STORAGE_BUCKET=torque-empire-teos-staging.firebasestorage.app
TEOS_ENVIRONMENT=staging
```

Do not use `production` as the target for staging values. Do not run `npx vercel --prod`, `npx vercel alias`, or any deployment command during this setup slice.

Safe metadata inspection:

```powershell
npx vercel whoami
npx vercel env ls
```

`vercel env ls` prints variable names and encrypted status only. Do not print, paste, or commit values.

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

Run the Vercel Preview isolation audit after Preview and Production values are available locally through ignored env files or inside controlled CI. The audit redacts values and prints only names/status:

```powershell
npx vercel env pull .vercel\.env.preview.local --environment=preview
npx vercel env pull .vercel\.env.production.local --environment=production
npx tsx scripts/staging/verifyVercelPreviewEnvironment.ts --preview-env-file .vercel\.env.preview.local --production-env-file .vercel\.env.production.local
Remove-Item -LiteralPath .vercel\.env.preview.local
Remove-Item -LiteralPath .vercel\.env.production.local
```

The `.vercel` directory is gitignored. Treat pulled env files as local secrets and delete them after verification.

## Safety Guard

Server-side Firebase use is guarded by `src/lib/server/environmentSafety.ts`.

The guard rejects:

- Preview deployments using `torque-empire-ai-pro-crm`
- Production deployments using `torque-empire-teos-staging`
- protected writes without server Firebase project identity
- protected writes without deployment environment identity
- public/Admin project ID mismatch
- development using production Firebase without `TEOS_ALLOW_DEVELOPMENT_PRODUCTION_FIREBASE=allow-development-production-firebase`

## Direct Script Guard Gap

The following direct scripts bypass `src/lib/server/environmentSafety.ts` and must not be run against staging or production until a separate hardening slice adds the same fail-closed environment guard:

- `scripts/bootstrapAdminRole.ts` initializes Firebase Admin directly from `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, then mutates Auth custom claims.
- `scripts/migrateDocuments.ts` initializes Firebase Admin directly from `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, then writes Firestore contractor document records.
- `scripts/migrate-deals.js` initializes Firebase Admin from `secrets/service-account.json`, then writes Firestore deal records.

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

- target only `torque-empire-teos-staging`
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

## Staging UAT Preparation Slice

Required local env before apply/reset: FIREBASE_PROJECT_ID=torque-empire-teos-staging, TEOS_ENVIRONMENT=staging, FIREBASE_STORAGE_BUCKET=torque-empire-teos-staging.firebasestorage.app, plus temporary staging Admin credential values.

Set TEOS_STAGING_ADMIN_PASSWORD and TEOS_STAGING_STAFF_PASSWORD only as temporary local environment variables. Do not commit or print them.

Seed dry-run: npx tsx scripts/staging/seedStagingUat.ts
Seed apply: npx tsx scripts/staging/seedStagingUat.ts --apply

All seeded records carry environment=staging, syntheticData=true, seedVersion=staging-uat-v1, createdBy=staging-seed.

Reset dry-run: npx tsx scripts/staging/resetStagingUat.ts
Reset delete: npx tsx scripts/staging/resetStagingUat.ts --confirm-delete-staging-synthetic-data

Reset refuses non-staging projects, verifies exact staging synthetic record markers, never deletes whole collections, and deletes Auth users only when staging synthetic custom claims are present.

## Browser UAT Checklist - Current Staging Slice

1. Sign in as staging admin.
2. Confirm banner: STAGING - TEST DATA ONLY.
3. Confirm no production Firebase identifiers appear.
4. Upload RFQ A.
5. Upload RFQ B.
6. Confirm RFQ A fields are cleared.
7. Create the synthetic opportunity.
8. Assign the canonical synthetic contractor.
9. Confirm the request succeeds without 401/403.
10. Confirm contractor count becomes 1.
11. Refresh.
12. Confirm assignment persists.
13. Confirm Tax and CSD blockers recalculate.
14. Confirm unresolved contractor cannot be assigned.
15. Confirm no production records were written.

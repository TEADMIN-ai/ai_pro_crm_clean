# Available Test Accounts

Generated: 2026-05-31

## Classification

FAIL

## Live Account Inventory

Live Firebase Auth account inventory could not be obtained.

Reason:

- `.env.local` does not contain Firebase Admin service-account variables.
- No local gcloud executable/configuration was found.
- Firebase Admin read-only attempts using Application Default Credentials timed out before returning account data.

No users were created, modified, deleted, or reset.

## Locally Discovered Account References

These are local code/test references only. They are not confirmed live Firebase accounts.

| Account reference | Source | Status |
| --- | --- | --- |
| `system@torque.empire` | `scripts/liveBenchmarkReplay.ts` | System actor reference, not a login credential |
| `staff@example.com` | `scripts/manusSanityCheck.ts` | Test/mock reference |
| `contractor@example.com` | `src/__tests__/contractorAuthLink.test.ts` | Test/mock reference |
| `existing@example.com` | `src/__tests__/contractorAuthLink.test.ts` | Test/mock reference |
| `jane@example.com` | multiple tests | Test/mock reference |
| `ops@example.com` | multiple tests | Test/mock reference |
| `reviewer@example.com` | tests | Test/mock reference |
| `test@example.com` | tests | Test/mock reference |
| `torqueempiresa@gmail.com` | SBD overlay constants | Document/sample data, not confirmed login |
| local `EMAIL_USER` value | `.env.local` | Tried through UI; Firebase rejected with `auth/invalid-credential` |

## Default Contractor Password Pattern

`src/app/api/contractors/route.ts` creates new contractor Firebase Auth users with:

```text
Temp123!
```

This is a creation-time default for new contractors. It does not confirm any existing contractor account is usable, and contractor accounts are not sufficient for `/api/tender-pack/generate` because that route requires admin, manager, or staff.

## Admin Accounts

No valid live admin account confirmed.

The script `scripts/bootstrapAdminRole.ts` can assign an admin role to a target UID, but using it would modify Firebase users. It was not executed.

## Staff Accounts

No valid live staff account confirmed.

Only mock/test references such as `staff@example.com` were found.

## Contractor Accounts

No valid live contractor account confirmed.

A contractor account is not the preferred account type for the EmpirePDF activation test because `/api/tender-pack/generate` requires a privileged role.

## Recommended Test Account

Use an existing live Firebase Auth account with:

- role: `admin`, `manager`, or `staff`
- valid email/password
- Firestore `users/{uid}` role profile or matching custom claims

Best candidate type:

```text
admin
```

## Account Readiness Result

No usable account was identified from the local environment.

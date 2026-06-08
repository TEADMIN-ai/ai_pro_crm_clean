# Authentication Test Readiness Report

Generated: 2026-05-31

## Classification

FAIL

## Executive Summary

A valid authenticated path for the EmpirePDF activation test was not identified in the local environment.

The CRM client is configured for Firebase project `torque-empire-ai-pro-crm`, but no valid Firebase login credentials were found or confirmed. The previous UI login attempt using the only locally configured email/password pair failed with `auth/invalid-credential`.

The server-side Firebase Admin configuration is also incomplete in `.env.local`: it does not define `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY`. The admin code will therefore use Application Default Credentials, but no local ADC/gcloud configuration was found, and read-only Firebase Admin inventory attempts timed out while resolving credentials.

## Findings

### Firebase Client Configuration

Client configuration is present in `.env.local`:

- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=torque-empire-ai-pro-crm.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=torque-empire-ai-pro-crm`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=torque-empire-ai-pro-crm.firebasestorage.app`
- Other public Firebase keys are present but redacted in this audit.

Client project alignment: PASS.

### Firebase Admin Configuration

Server admin code expects either:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

or Application Default Credentials.

In `.env.local`, only `FIREBASE_STORAGE_BUCKET` was present. The service account variables were not present.

Admin credential readiness: FAIL.

### Login Credential Status

The login form uses Firebase email/password auth. The only locally configured email/password pair was tried through the visible UI and failed with:

```text
Firebase: Error (auth/invalid-credential).
```

This means those values are not valid Firebase Auth login credentials for the configured project, or the password has changed/expired/revoked.

Credential readiness: FAIL.

### Required Role for EmpirePDF Test

The `/api/tender-pack/generate` route calls `assertPrivilegedRole(user)`.

Allowed roles:

- `admin`
- `manager`
- `staff`

A contractor account alone is not sufficient to run the Generate Tender Pack route unless the route is changed, which is outside this audit.

## Account to Use for Testing

Use a valid Firebase Auth user in project:

```text
torque-empire-ai-pro-crm
```

Required account profile:

- role: `admin`, `manager`, or `staff`
- able to sign in with Firebase email/password
- has a matching Firestore `users/{uid}` document or valid custom claims resolving to a privileged role
- can access a deal with a valid `contractorId`
- the contractor must satisfy the tender readiness gate

Recommended account type:

```text
admin or manager
```

## Valid Contractor Test Account

Not confirmed.

Reason:

- No live Firebase Auth user inventory could be read.
- No valid contractor login was available.
- Even if a contractor account exists, it would not satisfy `/api/tender-pack/generate` because that route requires a privileged role.

## Valid Admin Test Account

Not confirmed.

Reason:

- No valid admin credentials were found.
- Firebase Admin inventory could not be performed with the local environment.
- The local `EMAIL_USER` / `EMAIL_PASS` values are not valid Firebase Auth credentials.

## CRM Firebase Project Connection

Client-side connection appears pointed at the intended project:

```text
torque-empire-ai-pro-crm
```

Server-side admin connection could not be verified because service account variables are absent and Application Default Credentials were not available.

## Blockers to EmpirePDF Activation Test

1. No valid authenticated privileged test user is available.
2. No read-only Firebase Admin inventory is possible from this environment.
3. The previous UI login failed with `auth/invalid-credential`.
4. The test cannot reach the Generate Tender Pack UI workflow without authentication.

## Required Next Step

Provide one valid privileged Firebase Auth test account for `torque-empire-ai-pro-crm`:

- email
- password
- role expected: admin, manager, or staff
- known dealId or contractor page path for a tender-ready contractor

No user creation or password reset is required if an existing valid account is supplied.

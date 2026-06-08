# Login Flow Analysis

Generated: 2026-05-31

## Classification

WARNING

## Login Flow

1. User opens the CRM.
2. If unauthenticated, the app redirects to `/login`.
3. `LoginForm` collects email and password.
4. `signInWithEmailAndPassword(auth, email, password)` authenticates against Firebase client auth.
5. On success, the client gets an ID token through `credential.user.getIdToken(true)`.
6. The client calls `POST /api/auth/login` through `authFetch(...)`.
7. `authFetch(...)` attaches the Firebase ID token as:

```text
Authorization: Bearer <idToken>
```

8. `/api/auth/login` calls `requireAuth(request)`, which verifies the bearer token.
9. `/api/auth/login` verifies the submitted `idToken` again and creates a Firebase session cookie.
10. The response sets an HTTP-only `session` cookie.

## Login Route Requirements

`POST /api/auth/login` requires:

- a valid Firebase Auth ID token in the `Authorization` header
- an `idToken` in the JSON request body
- Firebase Admin ability to verify the ID token and create a session cookie

This means login depends on both:

- client Firebase Auth config
- server Firebase Admin credentials

## Tender Pack Route Requirements

`POST /api/tender-pack/generate` requires:

- authenticated request
- resolved user role
- privileged role: `admin`, `manager`, or `staff`
- valid `dealId`
- deal must have a valid `contractorId`
- contractor document must exist
- contractor compliance must pass:
  - `complianceApproved === true`
  - `docsMissing === 0`
  - `expiredDocumentCount === 0`
  - `tenderLockStatus === "READY"`

## Why Previous Activation Test Failed

The browser reached `/login`, but the available credentials were rejected by Firebase Auth:

```text
auth/invalid-credential
```

Because login failed before session cookie creation, the test could not reach:

- contractor data
- tender intake
- Generate Tender Pack button
- `/api/tender-pack/generate`
- `generateMergedPack()`

## Firebase Project Alignment

Client-side Firebase config points to:

```text
torque-empire-ai-pro-crm
```

Server-side admin project alignment is not confirmed from this environment because the expected service-account variables are missing and Application Default Credentials are unavailable.

## Readiness Assessment

The login flow itself is coherent, but test readiness is blocked by missing valid credentials and unverified server admin credentials.

## Valid Authenticated Path Needed

To complete the EmpirePDF activation test through the normal UI:

1. Sign in through `/login` using a real Firebase Auth user in `torque-empire-ai-pro-crm`.
2. The user must resolve to `admin`, `manager`, or `staff`.
3. Navigate to a contractor/tender workflow with a valid `dealId`.
4. Click `Generate Tender Pack`.
5. Confirm `/api/tender-pack/generate` returns the existing JSON response contract.

## Recommended Next Test Setup

Provide a known-good privileged test account and a known-ready deal:

```text
email: <valid admin/manager/staff email>
password: <valid password>
dealId: <deal with ready contractor>
contractorId: <ready contractor>
```

No Firebase user mutation is required if an existing valid account is supplied.

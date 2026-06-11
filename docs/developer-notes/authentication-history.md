# Authentication History

Date: 2026-06-11

## Firebase Mismatch Issue

The platform depends on the Firebase client project and Firebase Admin project matching the same production Firebase project. The relevant environment variables are:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET` or `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

Failure mode:

- Client login can succeed against one Firebase project while Admin SDK verifies or reads users from another project.
- This causes missing profiles, unresolved roles, session failures, or contractor linkage failures.

Final resolution:

- Keep all public Firebase variables and Admin SDK variables pointed at the same Firebase project.
- Confirm `FIREBASE_PROJECT_ID` in Vercel matches `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- Use `/api/health/firebase` and `/api/auth/health` after deployment.

## FIREBASE_PRIVATE_KEY Issue

The Admin SDK requires the private key with real newline characters. Vercel commonly stores it as escaped `\n` sequences.

Observed failure mode:

- Firebase Admin initialization fails or token/session operations fail when the key is pasted with incorrect escaping or extra quotes.

Final resolution:

- `src/lib/firebase/admin.ts` normalizes the private key by replacing escaped `\\n` with real newlines, removing wrapper quotes, and trimming whitespace.
- Vercel should store the full private key value quoted or escaped exactly as documented in `DEPLOYMENT.md`.

## Session Creation Issue

Session creation is handled by `POST /api/auth/login`.

Flow:

1. Client signs in with Firebase Auth and obtains an ID token.
2. Client posts the token to `/api/auth/login`.
3. Server verifies the ID token with Firebase Admin.
4. Server creates a 5-day Firebase session cookie.
5. Server writes the `session` cookie as `httpOnly`, `sameSite: lax`, and `secure` in production.

Observed failure mode:

- Invalid Admin SDK credentials, mismatched Firebase projects, or missing token caused session creation failures.

Final resolution:

- Firebase Admin initialization fixed.
- Session route logs token verification and cookie creation checkpoints.
- Cookie settings are production-compatible.

## /api/me Timeout Issue

`GET /api/me` verifies the bearer token and reads `users/{uid}` from Firestore.

Observed failure mode:

- A successful token verification could still stall or fail during profile lookup if Firestore/Admin configuration was unhealthy.

Final resolution:

- `/api/me` now logs each step: start, token verification, Firestore read start, Firestore read success/failure, role resolution, and response.
- Firestore profile lookup failures return `PROFILE_LOOKUP_FAILED` instead of silently timing out.
- Role resolution uses the Firestore profile first and token claims second.

## Final Resolution

Production authentication is considered operational when all checks pass:

- Firebase client login succeeds.
- `/api/auth/login` returns success and writes the session cookie.
- `/api/me` returns `uid`, `email`, `role`, and optional `contractorId`.
- Role dashboard routing works for admin, manager, staff, and contractor.
- Firebase Admin health endpoints return healthy.

Current status: operational, with continued release validation required after each environment or Firebase credential change.

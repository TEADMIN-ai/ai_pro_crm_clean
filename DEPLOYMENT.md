# AI Pro CRM Deployment Checklist

## 1. Required Environment Variables
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Firebase Admin setup:
- Go to Firebase Console -> Project Settings -> Service accounts.
- Generate a new private key and download the JSON file.
- Copy `project_id`, `client_email`, and `private_key` into `.env.local` or Vercel env vars.
- Replace private key line breaks with `\n` and keep the value quoted.
- The admin initializer converts `\\n` back to real newlines at runtime.

## 2. Vercel Deployment
1. Run `npm run build` locally and confirm it passes.
2. Run `npx vercel login`.
3. Run `npx vercel`.
4. In Vercel Project Settings -> Environment Variables, add:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID

## 3. Firebase Production Checks
- Firestore rules reviewed.
- Auth enabled with Email/Password.
- Production Firebase project selected.
- Staff user accounts created in Firebase Auth.
- Admin or staff roles assigned by the existing bootstrap or role sync flow.

## 4. Delivery Features To Verify
- Generate tender pack from the deals dashboard.
- Preview PDF.
- Download PDF.
- Trigger the email pack route.
- Confirm analysis summary and missing requirements appear in the PDF.

## 5. Staff Access Rollout
- Give staff the live Vercel URL.
- Create or import staff login accounts in Firebase Auth.
- Confirm each staff user can sign in and reach the dashboard.
- Staff workflow:
- Add contractors.
- Upload tenders.
- Generate packs.
- Download or email packs to clients.

System ready for Vercel deployment and staff onboarding.

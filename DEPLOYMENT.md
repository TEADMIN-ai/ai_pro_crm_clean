# 🚀 AI Pro CRM Deployment Checklist

## 1. Environment Variables
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Firebase Admin setup:
- Go to Firebase Console -> Project Settings -> Service accounts.
- Generate a new private key and download the JSON file.
- Copy `project_id`, `client_email`, and `private_key` into `.env.local`.
- Replace private key line breaks with `\n` and keep the value quoted.
- The admin initializer already converts `\\n` back to real newlines at runtime.

## 2. Firebase
- Firestore rules reviewed
- Auth enabled (Email/Password)
- Production project selected

## 3. Build
npm run build
npm start

## 4. Hosting
Recommended:
- Vercel (Next.js native)
- Firebase Hosting (SSR optional)

## 5. Post-Deploy
- Test login
- Create tender
- Download PDF
- Create car sale
- Download invoice

System ready.

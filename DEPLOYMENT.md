# 🚀 AI Pro CRM Deployment Checklist

## 1. Environment Variables
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID

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

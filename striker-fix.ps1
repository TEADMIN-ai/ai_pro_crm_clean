Write-Host "STRIKER FIX STARTING..."

# -----------------------------
# firebase.ts (FORCED EXPORTS)
# -----------------------------
$firebasePath = "src/lib/firebase.ts"
New-Item -ItemType Directory -Force -Path (Split-Path $firebasePath) | Out-Null

@'
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
'@ | Set-Content -Path $firebasePath

Write-Host "firebase.ts fixed"

# -----------------------------
# firestore.ts (FORCED EXPORTS)
# -----------------------------
$firestorePath = "src/lib/firestore.ts"

@'
import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export function listenCollection(path, cb) {
  if (!db) return () => {};
  return onSnapshot(collection(db, path), cb);
}

export function listenContractorData(contractorId, cb) {
  if (!db) return () => {};
  return onSnapshot(doc(db, "contractors", contractorId), cb);
}

export async function saveContractor(contractorId, data) {
  if (!db) return;
  await setDoc(
    doc(db, "contractors", contractorId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
'@ | Set-Content -Path $firestorePath

Write-Host "firestore.ts fixed"

# -----------------------------
# REMOVE ILLEGAL HTML/BODY
# -----------------------------
Get-ChildItem src -Recurse -Include *.js,*.jsx,*.tsx | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  if ($c -match "<html|<body") {
    $c = $c -replace "<\/?html[^>]*>", ""
    $c = $c -replace "<\/?body[^>]*>", ""
    Set-Content $_.FullName $c
  }
}

# -----------------------------
# CLEAR NEXT CACHE
# -----------------------------
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "STRIKER FIX COMPLETE"
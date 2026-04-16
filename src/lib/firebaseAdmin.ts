import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function formatPrivateKey(key: string | undefined) {
  if (!key) return undefined;

  let formatted = key;

  // Remove wrapping quotes if present
  if (formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.slice(1, -1);
  }

  // Handle escaped newlines (\n -> real line breaks)
  if (formatted.includes("\\n")) {
    formatted = formatted.replace(/\\n/g, "\n");
  }

  // Normalize Windows/Mac line endings
  formatted = formatted.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Ensure proper BEGIN/END formatting
  if (!formatted.includes("BEGIN PRIVATE KEY")) {
    console.error("Firebase key missing BEGIN header");
  }

  return formatted;
}

const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
const projectId = process.env.FIREBASE_PROJECT_ID;
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.appspot.com` : undefined);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    ...(storageBucket ? { storageBucket } : {}),
  });

  console.log("Firebase Admin initialized safely");
  console.log("ENV CHECK:");
  console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);
  console.log(
    "Client Email:",
    process.env.FIREBASE_CLIENT_EMAIL?.slice(0, 25) + "...",
  );
  console.log("Private Key Loaded:", !!privateKey);
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();
export const db = adminDb;

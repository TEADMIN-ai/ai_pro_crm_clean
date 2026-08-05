import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isSet = (value: string | undefined) => Boolean(value && value.trim());
const commitSha = () => process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GIT_COMMIT_SHA?.trim() || process.env.NEXT_PUBLIC_COMMIT_SHA?.trim() || null;
const isPreviewDeployment = () => process.env.VERCEL_ENV?.trim().toLowerCase() === "preview";

type ServiceStatus = "ready" | "not_configured" | "error";

export async function GET() {
  const startedAt = Date.now();
  const firebaseClientConfigured = [
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ].every(isSet);
  const firebaseAdminConfigured = [process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_CLIENT_EMAIL, process.env.FIREBASE_PRIVATE_KEY].every(isSet);
  const resendConfigured = [process.env.RESEND_API_KEY, process.env.RESEND_FROM_EMAIL].every(isSet);
  const openAiConfigured = isSet(process.env.OPENAI_API_KEY);
  const emailStatus: ServiceStatus = resendConfigured ? "ready" : "not_configured";

  let firestoreReady = false;
  let storageReady = false;
  let firestoreError: string | null = null;
  let storageError: string | null = null;
  let storageBucket: string | null = null;

  try {
    await getFirebaseAdmin().collection("_system").doc("health").get();
    firestoreReady = true;
  } catch (error) {
    firestoreError = error instanceof Error ? error.message : "Firestore health probe failed";
  }

  try {
    const bucket = getStorage().bucket();
    storageBucket = bucket.name ?? null;
    await bucket.exists();
    storageReady = true;
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Storage health probe failed";
  }

  const emailHealthy = emailStatus === "ready" || (isPreviewDeployment() && emailStatus === "not_configured");
  const ready = firebaseAdminConfigured && firebaseClientConfigured && openAiConfigured && firestoreReady && storageReady && emailHealthy;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      app: {
        name: "ai_pro_crm",
        nodeVersion: process.version,
        uptimeSeconds: Number(process.uptime().toFixed(3)),
        commitSha: commitSha(),
        checkedAt: new Date().toISOString(),
        routeResponseMs: Date.now() - startedAt,
      },
      readiness: {
        firebaseAdminReady: firebaseAdminConfigured && firestoreReady,
        firebaseAdminConfigured,
        firebaseClientConfigured,
        firestoreReady,
        firestoreStatus: firestoreReady ? "ready" : "error",
        firestoreError,
        storageReady,
        storageStatus: storageReady ? "ready" : "error",
        storageBucket,
        storageError,
        resendConfigured,
        emailStatus,
        openAiConfigured,
      },
      services: {
        firebase: firebaseAdminConfigured && firestoreReady,
        firestore: firestoreReady ? "ready" : "error",
        storage: storageReady ? "ready" : "error",
        email: emailStatus,
        openai: openAiConfigured,
      },
    },
    { status: ready ? 200 : 503 },
  );
}

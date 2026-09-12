import { applicationDefault, cert, getApps, initializeApp, type AppOptions, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertFirebaseEnvironmentSafe } from "@/lib/server/environmentSafety";

function normalizePrivateKey(privateKey: string | undefined) {
  return privateKey?.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim();
}

function resolveAdminCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    return {
      credential: applicationDefault(),
      credentialSource: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
        ? "googleApplicationCredentials" as const
        : "applicationDefault" as const,
    };
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  return {
    credential: cert(serviceAccount),
    credentialSource: "serviceAccount" as const,
  };
}

if (!getApps().length) {
  const environmentClassification = assertFirebaseEnvironmentSafe({
    operation: "admin-init",
    requireProjectId: process.env.NODE_ENV !== "test",
    requireDeploymentIdentity: process.env.NODE_ENV !== "test",
  });
  const { credential, credentialSource } = resolveAdminCredential();
  const appOptions: AppOptions = {
    credential,
  };

  initializeApp(appOptions);

  console.log("[FIREBASE_ADMIN_INIT]", {
    credentialSource,
    deploymentEnvironment: environmentClassification.deploymentEnvironment,
    projectId: environmentClassification.firebaseProjectId,
    storageBucket: null,
  });
}

export const adminDb = getFirestore();
export const getFirebaseAdmin = () => adminDb;

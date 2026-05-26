import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

type LogLevel = "INFO" | "ERROR";

type LogFields = Record<string, string | number | boolean | null>;

type AdminClaims = {
  role: "admin";
};

const ADMIN_CLAIMS: AdminClaims = { role: "admin" };

const log = (level: LogLevel, event: string, fields: LogFields = {}): void => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  console.log(JSON.stringify(payload));
};

const loadServiceAccountFromEnv = (): ServiceAccount => {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials in environment variables.");
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const hasExactAdminClaims = (claims: Record<string, unknown> | undefined): boolean => {
  if (!claims) {
    return false;
  }

  const keys = Object.keys(claims);
  return keys.length === 1 && claims.role === "admin";
};

const bootstrapAdminRole = async (): Promise<void> => {
  const targetUid = process.env.TARGET_UID;

  if (typeof targetUid !== "string" || targetUid.trim() === "") {
    throw new Error("TARGET_UID environment variable is required.");
  }

  const uid = targetUid.trim();
  log("INFO", "bootstrap_start", { uid });

  const serviceAccount = loadServiceAccountFromEnv();

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  const auth = getAuth();

  log("INFO", "user_lookup_start", { uid });
  const existingUser = await auth.getUser(uid);

  if (hasExactAdminClaims(existingUser.customClaims)) {
    log("INFO", "admin_role_already_present", { uid });
    console.log(`Success: UID ${uid} already has role=admin`);
    return;
  }

  log("INFO", "set_custom_claims_start", { uid });
  await auth.setCustomUserClaims(uid, ADMIN_CLAIMS);

  log("INFO", "verify_custom_claims_start", { uid });
  const verifiedUser = await auth.getUser(uid);

  if (!hasExactAdminClaims(verifiedUser.customClaims)) {
    throw new Error('Custom claim verification failed. Expected exactly {"role":"admin"}.');
  }

  log("INFO", "admin_role_assigned", { uid });
  console.log(`Success: Assigned role=admin to UID ${uid}`);
};

bootstrapAdminRole().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  log("ERROR", "bootstrap_failed", { message });
  console.error(`Error: ${message}`);
  process.exit(1);
});

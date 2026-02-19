import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

type LogLevel = "INFO" | "ERROR";

type LogFields = Record<string, string | number | boolean | null>;

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseServiceAccountJson = (raw: unknown): ServiceAccountJson => {
  if (!isRecord(raw)) {
    throw new Error("Service account JSON is not an object.");
  }

  const projectId = raw.project_id;
  const clientEmail = raw.client_email;
  const privateKey = raw.private_key;

  if (typeof projectId !== "string" || projectId.trim() === "") {
    throw new Error("Service account project_id is missing or invalid.");
  }

  if (typeof clientEmail !== "string" || clientEmail.trim() === "") {
    throw new Error("Service account client_email is missing or invalid.");
  }

  if (typeof privateKey !== "string" || privateKey.trim() === "") {
    throw new Error("Service account private_key is missing or invalid.");
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
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
  const serviceAccountPath = path.resolve(process.cwd(), "secrets", "service-account.json");

  log("INFO", "bootstrap_start", { uid, serviceAccountPath });

  if (!existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccountRaw = readFileSync(serviceAccountPath, "utf8");
  const parsedJson: unknown = JSON.parse(serviceAccountRaw);
  const serviceAccountJson = parseServiceAccountJson(parsedJson);

  const serviceAccount: ServiceAccount = {
    projectId: serviceAccountJson.project_id,
    clientEmail: serviceAccountJson.client_email,
    privateKey: serviceAccountJson.private_key,
  };

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

import fs from "node:fs";
import path from "node:path";

export interface FirebaseEnvValidationResult {
  valid: boolean;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  privateKeyLoaded: boolean;
  credentialSource?: "serviceAccountEnv" | "googleApplicationCredentials";
  missing: string[];
  malformed: string[];
  message?: string;
}

interface GoogleApplicationCredentialsValidation {
  valid: boolean;
  projectId?: string;
  clientEmail?: string;
  privateKeyLoaded: boolean;
  missing: string[];
  malformed: string[];
  message?: string;
}

function normalizePrivateKey(key: string | undefined) {
  const rawKey = key || "";
  const privateKey = rawKey.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1");

  if (!privateKey) {
    return undefined;
  }

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Invalid Firebase private key format");
  }

  return privateKey;
}

function logFirebaseEnvError(result: FirebaseEnvValidationResult) {
  console.error("[firebase-env] validation_failed", {
    missing: result.missing,
    malformed: result.malformed,
    projectId: result.projectId ?? null,
    clientEmailPresent: Boolean(result.clientEmail),
    privateKeyLoaded: result.privateKeyLoaded,
    credentialSource: result.credentialSource ?? null,
    message: result.message ?? null,
  });
}

function validateGoogleApplicationCredentials(): GoogleApplicationCredentialsValidation {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!credentialsPath) {
    return {
      valid: false,
      privateKeyLoaded: false,
      missing: ["GOOGLE_APPLICATION_CREDENTIALS"],
      malformed: [],
    };
  }

  const resolvedPath = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.resolve(process.cwd(), credentialsPath);

  try {
    const rawCredentials = fs.readFileSync(resolvedPath, "utf8");
    const credentials = JSON.parse(rawCredentials) as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };
    const projectId = typeof credentials.project_id === "string" ? credentials.project_id.trim() : "";
    const clientEmail = typeof credentials.client_email === "string" ? credentials.client_email.trim() : "";
    const privateKey = typeof credentials.private_key === "string" ? credentials.private_key : "";
    const missing: string[] = [];
    const malformed: string[] = [];

    if (!projectId) {
      missing.push("GOOGLE_APPLICATION_CREDENTIALS.project_id");
    }

    if (!clientEmail) {
      missing.push("GOOGLE_APPLICATION_CREDENTIALS.client_email");
    } else if (!clientEmail.includes("@")) {
      malformed.push("GOOGLE_APPLICATION_CREDENTIALS.client_email");
    }

    try {
      normalizePrivateKey(privateKey);
    } catch {
      malformed.push("GOOGLE_APPLICATION_CREDENTIALS.private_key");
    }

    if (!privateKey) {
      missing.push("GOOGLE_APPLICATION_CREDENTIALS.private_key");
    }

    const valid = missing.length === 0 && malformed.length === 0;

    return {
      valid,
      projectId,
      clientEmail,
      privateKeyLoaded: Boolean(privateKey),
      missing,
      malformed,
      message: valid
        ? undefined
        : [
            missing.length > 0 ? `Missing: ${missing.join(", ")}` : null,
            malformed.length > 0 ? `Malformed: ${malformed.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
    };
  } catch (error) {
    return {
      valid: false,
      privateKeyLoaded: false,
      missing: [],
      malformed: ["GOOGLE_APPLICATION_CREDENTIALS"],
      message: error instanceof Error ? error.message : "Invalid GOOGLE_APPLICATION_CREDENTIALS",
    };
  }
}

export function validateFirebaseEnv(): FirebaseEnvValidationResult {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey: string | undefined;

  try {
    privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  } catch (error) {
    const result: FirebaseEnvValidationResult = {
      valid: false,
      projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey: undefined,
      privateKeyLoaded: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      credentialSource: "serviceAccountEnv",
      missing: [],
      malformed: ["FIREBASE_PRIVATE_KEY"],
      message: error instanceof Error ? error.message : "Invalid Firebase private key format",
    };

    const googleCredentials = validateGoogleApplicationCredentials();
    if (googleCredentials.valid) {
      return {
        valid: true,
        projectId: googleCredentials.projectId,
        clientEmail: googleCredentials.clientEmail,
        privateKey: undefined,
        privateKeyLoaded: googleCredentials.privateKeyLoaded,
        credentialSource: "googleApplicationCredentials",
        missing: [],
        malformed: [],
      };
    }

    result.missing.push(...googleCredentials.missing);
    result.malformed.push(...googleCredentials.malformed);
    result.message = [result.message, googleCredentials.message].filter(Boolean).join(" | ");
    logFirebaseEnvError(result);
    return result;
  }

  const missing: string[] = [];
  const malformed: string[] = [];

  if (!projectId) {
    missing.push("FIREBASE_PROJECT_ID");
  }

  if (!clientEmail) {
    missing.push("FIREBASE_CLIENT_EMAIL");
  } else if (!clientEmail.includes("@")) {
    malformed.push("FIREBASE_CLIENT_EMAIL");
  }

  if (!privateKey) {
    missing.push("FIREBASE_PRIVATE_KEY");
  } else {
    const hasBeginMarker = privateKey.includes("-----BEGIN PRIVATE KEY-----");
    const hasEndMarker = privateKey.includes("-----END PRIVATE KEY-----");

    if (!hasBeginMarker || !hasEndMarker) {
      malformed.push("FIREBASE_PRIVATE_KEY");
    }
  }

  const envCredentialsValid = missing.length === 0 && malformed.length === 0;
  const googleCredentials = envCredentialsValid ? null : validateGoogleApplicationCredentials();
  const valid = envCredentialsValid || googleCredentials?.valid === true;
  const credentialSource = envCredentialsValid
    ? "serviceAccountEnv"
    : googleCredentials?.valid
      ? "googleApplicationCredentials"
      : undefined;
  const validationMissing = valid ? [] : [...missing, ...(googleCredentials?.missing ?? [])];
  const validationMalformed = valid ? [] : [...malformed, ...(googleCredentials?.malformed ?? [])];
  const message = valid
    ? undefined
    : [
        validationMissing.length > 0 ? `Missing: ${validationMissing.join(", ")}` : null,
        validationMalformed.length > 0 ? `Malformed: ${validationMalformed.join(", ")}` : null,
        googleCredentials?.message ?? null,
      ]
        .filter(Boolean)
        .join(" | ");

  const result: FirebaseEnvValidationResult = {
    valid,
    projectId: envCredentialsValid ? projectId : googleCredentials?.projectId ?? projectId,
    clientEmail: envCredentialsValid ? clientEmail : googleCredentials?.clientEmail ?? clientEmail,
    privateKey: envCredentialsValid ? privateKey : undefined,
    privateKeyLoaded: envCredentialsValid ? Boolean(privateKey) : googleCredentials?.privateKeyLoaded ?? false,
    credentialSource,
    missing: validationMissing,
    malformed: validationMalformed,
    message,
  };

  if (!valid) {
    logFirebaseEnvError(result);
  }

  return result;
}

export function assertValidFirebaseEnv(): FirebaseEnvValidationResult {
  const result = validateFirebaseEnv();

  if (!result.valid) {
    throw new Error(result.message ?? "Firebase environment validation failed.");
  }

  return result;
}

export interface FirebaseEnvValidationResult {
  valid: boolean;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
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
    message: result.message ?? null,
  });
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
      missing: [],
      malformed: ["FIREBASE_PRIVATE_KEY"],
      message: error instanceof Error ? error.message : "Invalid Firebase private key format",
    };

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

  const valid = missing.length === 0 && malformed.length === 0;
  const message = valid
    ? undefined
    : [
        missing.length > 0 ? `Missing: ${missing.join(", ")}` : null,
        malformed.length > 0 ? `Malformed: ${malformed.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

  const result: FirebaseEnvValidationResult = {
    valid,
    projectId,
    clientEmail,
    privateKey,
    privateKeyLoaded: Boolean(privateKey),
    missing,
    malformed,
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

function normalizePrivateKey(rawPrivateKey?: string) {
  if (!rawPrivateKey) {
    throw new Error("Missing Firebase Admin private key");
  }

  const hasEscapedNewlines = rawPrivateKey.includes("\\n");
  const hasRealLineBreaks = /\r|\n/.test(rawPrivateKey);

  let normalizedPrivateKey = rawPrivateKey;

  // Convert escaped \n → real new lines
  if (hasEscapedNewlines) {
    normalizedPrivateKey = normalizedPrivateKey.replace(/\\n/g, "\n");
  }

  // Remove Windows carriage returns + trim
  normalizedPrivateKey = normalizedPrivateKey
    .replace(/\r/g, "")
    .trim();

  const hasBeginMarker = normalizedPrivateKey.includes("-----BEGIN PRIVATE KEY-----");
  const hasEndMarker = normalizedPrivateKey.includes("-----END PRIVATE KEY-----");

  const lines = normalizedPrivateKey
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lineCount = lines.length;

  // 🔍 Debug (SAFE — no key leakage)
  console.log("Firebase Admin private key format:", {
    hasEscapedNewlines,
    hasRealLineBreaks,
    hasBeginMarker,
    hasEndMarker,
    lineCount,
  });

  if (!hasBeginMarker || !hasEndMarker || lineCount < 3) {
    throw new Error("Malformed Firebase Admin private key");
  }

  return normalizedPrivateKey;
}

export const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
};

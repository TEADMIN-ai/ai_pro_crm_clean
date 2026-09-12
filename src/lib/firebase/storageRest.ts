import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertFirebaseEnvironmentSafe } from "@/lib/server/environmentSafety";

type StorageCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STORAGE_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";
let cachedAccessToken: CachedAccessToken | null = null;

function normalizePrivateKey(privateKey: string | undefined): string | null {
  const normalized = privateKey?.replace(/\\n/g, "\n").replace(/^"(.*)"$/, "$1").trim();
  return normalized || null;
}

function resolveStorageBucketName(): string | null {
  const rawBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim()
    || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  return rawBucket
    ? rawBucket.replace(/^gs:\/\//, "").replace(/^https?:\/\/storage.googleapis.com\//, "").replace(/\/+$/, "")
    : null;
}

function resolveCredentialsFromGoogleApplicationCredentials(): StorageCredentials | null {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) return null;
  if (!path.isAbsolute(credentialsPath)) return null;

  const rawCredentials = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ credentialsPath, "utf8")) as {
    project_id?: unknown;
    client_email?: unknown;
    private_key?: unknown;
  };
  const projectId = typeof rawCredentials.project_id === "string" ? rawCredentials.project_id.trim() : "";
  const clientEmail = typeof rawCredentials.client_email === "string" ? rawCredentials.client_email.trim() : "";
  const privateKey = typeof rawCredentials.private_key === "string"
    ? normalizePrivateKey(rawCredentials.private_key)
    : null;

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function resolveStorageCredentials(): StorageCredentials {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  const credentials = resolveCredentialsFromGoogleApplicationCredentials();
  if (credentials) return credentials;

  throw new Error("Firebase Storage REST credentials are not configured.");
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getStorageAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.token;
  }

  const credentials = resolveStorageCredentials();
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: STORAGE_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(credentials.privateKey);
  const assertion = `${header}.${claim}.${base64Url(signature)}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase Storage token request failed with ${response.status}.`);
  }

  const tokenResponse = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof tokenResponse.access_token !== "string") {
    throw new Error("Firebase Storage token response did not include an access token.");
  }

  cachedAccessToken = {
    token: tokenResponse.access_token,
    expiresAt: now + (typeof tokenResponse.expires_in === "number" ? tokenResponse.expires_in : 3600),
  };
  return cachedAccessToken.token;
}

export async function downloadFirebaseStorageObject(storagePath: string): Promise<Uint8Array> {
  assertFirebaseEnvironmentSafe({
    operation: "admin-init",
    requireProjectId: process.env.NODE_ENV !== "test",
    requireDeploymentIdentity: process.env.NODE_ENV !== "test",
  });

  const bucket = resolveStorageBucketName();
  if (!bucket) throw new Error("Firebase Storage bucket is not configured.");

  const token = await getStorageAccessToken();
  const objectUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(storagePath)}?alt=media`;
  const response = await fetch(objectUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Firebase Storage object download failed with ${response.status}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

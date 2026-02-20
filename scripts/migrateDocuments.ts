import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function loadServiceAccountFromEnv(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

function loadServiceAccountFromFile(): ServiceAccount {
  const filePath = path.join(process.cwd(), "secrets", "service-account.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;

  if (!parsed.projectId || !parsed.clientEmail || !parsed.privateKey) {
    throw new Error("Invalid service account file");
  }

  return {
    projectId: parsed.projectId,
    clientEmail: parsed.clientEmail,
    privateKey: parsed.privateKey,
  };
}

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccount = loadServiceAccountFromEnv() ?? loadServiceAccountFromFile();

  initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

function normalizeDocument(data: Record<string, unknown>) {
  const fileName =
    getString(data.fileName) ??
    getString(data.originalName) ??
    getString(data.filename) ??
    getString(data.docType) ??
    "Recovered document";

  const docType = getString(data.docType) ?? "general";
  const status = getString(data.status) ?? "active";
  const createdAt =
    typeof data.createdAt === "number" && Number.isFinite(data.createdAt)
      ? data.createdAt
      : Date.now();

  return {
    fileName,
    originalName: getString(data.originalName) ?? fileName,
    docType,
    status,
    createdAt,
  };
}

async function migrateDocuments() {
  initAdmin();

  const db = getFirestore();
  const snapshot = await db.collection("documents").get();

  if (snapshot.empty) {
    console.log("No documents found in collection \"documents\".");
    return;
  }

  console.log(`Found ${snapshot.size} documents. Starting safe migration...`);

  const docs = snapshot.docs;
  const chunkSize = 400;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + chunkSize);

    for (const docSnap of chunk) {
      const normalized = normalizeDocument(docSnap.data() as Record<string, unknown>);

      // Idempotent in-place update. No new documents are created.
      batch.set(docSnap.ref, normalized, { merge: true });
    }

    await batch.commit();
    console.log(`Processed ${Math.min(i + chunk.length, docs.length)} / ${docs.length}`);
  }

  console.log("Document migration completed successfully.");
}

migrateDocuments().catch((error) => {
  console.error("Document migration failed:", error);
  process.exitCode = 1;
});

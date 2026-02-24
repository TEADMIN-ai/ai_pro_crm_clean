import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  detectDocTypeFromFileName,
  getString,
  normalizeCreatedAt,
  resolveDocumentFileName,
  RECOVERED_DOCUMENT_PLACEHOLDER,
} from "../src/lib/documents/normalizeDocumentName";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

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
  const parsed = JSON.parse(raw) as Partial<ServiceAccount> & {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  const projectId = parsed.projectId ?? parsed.project_id;
  const clientEmail = parsed.clientEmail ?? parsed.client_email;
  const privateKey = parsed.privateKey ?? parsed.private_key;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Invalid service account file");
  }

  return {
    projectId,
    clientEmail,
    privateKey,
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
  const fileName = resolveDocumentFileName(data);
  const docType = getString(data.docType) ?? detectDocTypeFromFileName(fileName);
  const status = getString(data.status) ?? "active";
  const createdAt = normalizeCreatedAt(data.createdAt);

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
  const contractorsSnapshot = await db.collection("contractors").get();

  if (contractorsSnapshot.empty) {
    console.log("No contractors found in collection \"contractors\".");
    return;
  }

  console.log(`Found ${contractorsSnapshot.size} contractors. Starting safe migration...`);

  const docs: any[] = [];

  for (const contractorDoc of contractorsSnapshot.docs) {
    const documentsSnapshot = await contractorDoc.ref.collection("documents").get();
    for (const documentDoc of documentsSnapshot.docs) {
      docs.push(documentDoc);
    }
  }

  if (docs.length === 0) {
    console.log("No contractor documents found to migrate.");
    return;
  }

  let scanned = 0;
  let matchedLegacyCriteria = 0;
  let upgraded = 0;
  let unresolved = 0;

  const chunkSize = 350;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + chunkSize);

    for (const docSnap of chunk) {
      scanned += 1;
      const raw = docSnap.data() as Record<string, unknown>;
      const currentFileName = getString(raw.fileName);
      const currentOriginalName = getString(raw.originalName);
      const shouldMigrate =
        !currentFileName ||
        currentFileName === RECOVERED_DOCUMENT_PLACEHOLDER ||
        !currentOriginalName;

      if (!shouldMigrate) {
        continue;
      }

      matchedLegacyCriteria += 1;

      const normalized = normalizeDocument(raw);
      if (normalized.fileName === RECOVERED_DOCUMENT_PLACEHOLDER) {
        unresolved += 1;
      }

      const nextPayload: Record<string, unknown> = {
        fileName: normalized.fileName,
        originalName: normalized.originalName,
        docType: normalized.docType,
        createdAt: normalized.createdAt,
      };

      const changed =
        raw.fileName !== nextPayload.fileName ||
        raw.originalName !== nextPayload.originalName ||
        raw.docType !== nextPayload.docType ||
        raw.createdAt !== nextPayload.createdAt;

      if (!changed) {
        continue;
      }

      // Idempotent in-place update. No new documents are created.
      batch.set(docSnap.ref, nextPayload, { merge: true });
      upgraded += 1;
    }

    await batch.commit();
    console.log(`Processed ${Math.min(i + chunk.length, docs.length)} / ${docs.length}`);
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        matchedLegacyCriteria,
        upgraded,
        unresolvedAfterUpgrade: unresolved,
      },
      null,
      2
    )
  );

  console.log("Document migration completed successfully.");
}

migrateDocuments().catch((error) => {
  console.error("Document migration failed:", error);
  process.exitCode = 1;
});

import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";

type PersistTenderPackInput = {
  contractorId: string;
  createdBy: string;
  templateKey: string;
  pdfBytes: Buffer | Uint8Array | ArrayBuffer | Blob;
  missingFields: string[];
  warnings: string[];
  fieldMapUsed: Record<string, string>;
};

type CreateTenderPackRecordInput = {
  storagePath: string;
  downloadURL: string;
  downloadUrl: string;
  createdAt: number;
  expiresAt: number;
  createdBy: string;
  contractorId: string;
  templateKey: string;
  missingFields: string[];
  warnings: string[];
  fieldMapUsed: Record<string, string>;
  fileName: string;
  contentType: "application/pdf";
  size: number;
};

const DEFAULT_TENDER_PACK_ARTIFACT_URL_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_TENDER_PACK_ARTIFACT_RETENTION_MS = 1000 * 60 * 60 * 24 * 7;

async function normalizePdfBuffer(pdfBytes: PersistTenderPackInput["pdfBytes"]): Promise<Buffer> {
  if (Buffer.isBuffer(pdfBytes)) {
    return pdfBytes;
  }

  if (pdfBytes instanceof Uint8Array) {
    return Buffer.from(pdfBytes);
  }

  if (pdfBytes instanceof ArrayBuffer) {
    return Buffer.from(pdfBytes);
  }

  const blob = pdfBytes instanceof Blob ? pdfBytes : new Blob([pdfBytes], { type: "application/pdf" });
  const arrayBuffer = await blob.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

export async function createTenderPackRecord(input: CreateTenderPackRecordInput) {
  const packRef = await getFirebaseAdmin().collection("tenderPacks").add({
    ...input,
    updatedAt: input.createdAt,
    createdAtServer: FieldValue.serverTimestamp(),
    updatedAtServer: FieldValue.serverTimestamp(),
  });

  return packRef.id;
}

export async function persistTenderPackPdf(input: PersistTenderPackInput) {
  const createdAt = Date.now();
  const expiresAt = createdAt + DEFAULT_TENDER_PACK_ARTIFACT_RETENTION_MS;
  const normalizedTemplateKey = input.templateKey.trim().toLowerCase();
  const fileName = `${createdAt}-${normalizedTemplateKey}.pdf`;
  const storagePath = `tenderPacks/${input.contractorId}/${fileName}`;
  const pdfBuffer = await normalizePdfBuffer(input.pdfBytes);
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(storagePath);

  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: {
      cacheControl: "private, max-age=300",
      metadata: {
        contractorId: input.contractorId,
        createdBy: input.createdBy,
        templateKey: input.templateKey,
        cleanupPolicy: "retention_window",
        expiresAt: String(expiresAt),
      },
    },
  });

  const [downloadURL] = await file.getSignedUrl({
    action: "read",
    expires: createdAt + DEFAULT_TENDER_PACK_ARTIFACT_URL_TTL_MS,
  });

  let packId = "";

  try {
    packId = await createTenderPackRecord({
      storagePath,
      downloadURL,
      downloadUrl: downloadURL,
      createdAt,
      expiresAt,
      createdBy: input.createdBy,
      contractorId: input.contractorId,
      templateKey: input.templateKey,
      missingFields: input.missingFields,
      warnings: input.warnings,
      fieldMapUsed: input.fieldMapUsed,
      fileName,
      contentType: "application/pdf",
      size: pdfBuffer.byteLength,
    });
  } catch (error) {
    await file.delete({ ignoreNotFound: true });
    throw error;
  }

  return {
    packId,
    storagePath,
    downloadURL,
    downloadUrl: downloadURL,
    fileName,
    size: pdfBuffer.byteLength,
    createdAt,
    expiresAt,
  };
}

import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

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
  createdAt: number;
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
  const normalizedTemplateKey = input.templateKey.trim().toLowerCase();
  const fileName = `${createdAt}-${normalizedTemplateKey}.pdf`;
  const storagePath = `tenderPacks/${input.contractorId}/${fileName}`;
  const pdfBuffer = await normalizePdfBuffer(input.pdfBytes);
  const file = getStorage().bucket().file(storagePath);

  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: {
      cacheControl: "private, max-age=300",
      metadata: {
        contractorId: input.contractorId,
        createdBy: input.createdBy,
        templateKey: input.templateKey,
      },
    },
  });

  const [downloadURL] = await file.getSignedUrl({
    action: "read",
    expires: "2035-01-01",
  });

  const packId = await createTenderPackRecord({
    storagePath,
    downloadURL,
    createdAt,
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

  return {
    packId,
    storagePath,
    downloadURL,
    fileName,
    size: pdfBuffer.byteLength,
    createdAt,
  };
}

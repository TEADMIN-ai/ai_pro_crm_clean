import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";

type PdfBytes = Buffer | Uint8Array | ArrayBuffer | Blob;

type PersistArtifactBase = {
  contractorId: string;
  createdBy: string;
  templateKey: string;
  pdfBytes: PdfBytes;
  missingFields: string[];
  warnings: string[];
  fieldMapUsed: Record<string, string>;
};

export type PersistTenderPackInput = PersistArtifactBase & {
  dealId: string;
  opportunityId: string;
  workspaceId: string;
  clientQuoteId: string;
};

export type PersistLegacyTenderPackInput = PersistArtifactBase & {
  dealId: string;
  workspaceId?: string | null;
};

export type PersistGenericTenderPackInput = PersistArtifactBase;

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
  filename: string;
  contentType: "application/pdf";
  size: number;
  governanceMode: "GOVERNED" | "LEGACY" | "GENERIC";
  dealId?: string | null;
  opportunityId?: string | null;
  workspaceId?: string | null;
  clientQuoteId?: string | null;
};

const DEFAULT_TENDER_PACK_ARTIFACT_URL_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_TENDER_PACK_ARTIFACT_RETENTION_MS = 1000 * 60 * 60 * 24 * 7;

function requireCanonicalId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required for governed tender pack persistence`);
  }
  return normalized;
}

function optionalId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function normalizePdfBuffer(pdfBytes: PdfBytes): Promise<Buffer> {
  if (Buffer.isBuffer(pdfBytes)) return pdfBytes;
  if (pdfBytes instanceof Uint8Array) return Buffer.from(pdfBytes);
  if (pdfBytes instanceof ArrayBuffer) return Buffer.from(pdfBytes);

  const blob = pdfBytes instanceof Blob ? pdfBytes : new Blob([pdfBytes], { type: "application/pdf" });
  return Buffer.from(await blob.arrayBuffer());
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

async function persistArtifact(input: PersistArtifactBase & {
  governanceMode: "GOVERNED" | "LEGACY" | "GENERIC";
  dealId?: string | null;
  opportunityId?: string | null;
  workspaceId?: string | null;
  clientQuoteId?: string | null;
}) {
  const createdAt = Date.now();
  const expiresAt = createdAt + DEFAULT_TENDER_PACK_ARTIFACT_RETENTION_MS;
  const contractorId = requireCanonicalId(input.contractorId, "contractorId");
  const normalizedTemplateKey = requireCanonicalId(input.templateKey, "templateKey").toLowerCase();
  const fileName = `${createdAt}-${normalizedTemplateKey}.pdf`;
  const ownershipSegments = input.governanceMode === "GOVERNED"
    ? ["governed", requireCanonicalId(input.workspaceId ?? "", "workspaceId"), requireCanonicalId(input.dealId ?? "", "dealId"), contractorId]
    : input.governanceMode === "LEGACY"
      ? ["legacy", optionalId(input.workspaceId) ?? "unscoped", requireCanonicalId(input.dealId ?? "", "dealId"), contractorId]
      : ["generic", contractorId];
  const storagePath = `tenderPacks/${ownershipSegments.join("/")}/${fileName}`;
  const pdfBuffer = await normalizePdfBuffer(input.pdfBytes);
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(storagePath);

  const metadata: Record<string, string> = {
    contractorId,
    createdBy: input.createdBy,
    templateKey: input.templateKey,
    governanceMode: input.governanceMode,
    cleanupPolicy: "retention_window",
    expiresAt: String(expiresAt),
  };
  for (const [key, value] of Object.entries({
    dealId: optionalId(input.dealId),
    opportunityId: optionalId(input.opportunityId),
    workspaceId: optionalId(input.workspaceId),
    clientQuoteId: optionalId(input.clientQuoteId),
  })) {
    if (value) metadata[key] = value;
  }

  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: {
      cacheControl: "private, max-age=300",
      metadata,
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
      contractorId,
      templateKey: input.templateKey,
      missingFields: input.missingFields,
      warnings: input.warnings,
      fieldMapUsed: input.fieldMapUsed,
      fileName,
      filename: fileName,
      contentType: "application/pdf",
      size: pdfBuffer.byteLength,
      governanceMode: input.governanceMode,
      dealId: optionalId(input.dealId),
      opportunityId: optionalId(input.opportunityId),
      workspaceId: optionalId(input.workspaceId),
      clientQuoteId: optionalId(input.clientQuoteId),
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

export async function persistTenderPackPdf(input: PersistTenderPackInput) {
  const dealId = requireCanonicalId(input.dealId, "dealId");
  const opportunityId = requireCanonicalId(input.opportunityId, "opportunityId");
  const workspaceId = requireCanonicalId(input.workspaceId, "workspaceId");
  const clientQuoteId = requireCanonicalId(input.clientQuoteId, "clientQuoteId");
  requireCanonicalId(input.contractorId, "contractorId");

  return persistArtifact({
    ...input,
    governanceMode: "GOVERNED",
    dealId,
    opportunityId,
    workspaceId,
    clientQuoteId,
  });
}

export async function persistLegacyTenderPackPdf(input: PersistLegacyTenderPackInput) {
  return persistArtifact({
    ...input,
    governanceMode: "LEGACY",
    dealId: requireCanonicalId(input.dealId, "dealId"),
    workspaceId: optionalId(input.workspaceId),
    opportunityId: null,
    clientQuoteId: null,
  });
}

export async function persistGenericTenderPackPdf(input: PersistGenericTenderPackInput) {
  return persistArtifact({
    ...input,
    governanceMode: "GENERIC",
    dealId: null,
    opportunityId: null,
    workspaceId: null,
    clientQuoteId: null,
  });
}

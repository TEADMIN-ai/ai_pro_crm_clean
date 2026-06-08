import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const CONTRACTOR_ACKNOWLEDGEMENT_VERSION = "contractor-onboarding-v1";

export type ContractorAcknowledgementRecord = {
  id: string;
  contractorId: string;
  userUid: string;
  signatureText: string;
  signedByName: string;
  signedByCapacity: string;
  acceptedTerms: boolean;
  authorityConfirmed: boolean;
  acknowledgementVersion: string;
  signedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: "valid";
};

export type ContractorSignaturePayload = {
  contractorId: string;
  acknowledgementId: string;
  signatureText: string;
  signedByName: string;
  signedByCapacity: string;
  signedAt: string;
  acknowledgementVersion: string;
  userUid: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const parsed = value.toDate() as Date;
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function normalizeAcknowledgement(
  id: string,
  contractorId: string,
  data: Record<string, unknown>,
): ContractorAcknowledgementRecord | null {
  const signatureText = asString(data.signatureText);
  const signedByName = asString(data.signedByName);
  const signedByCapacity = asString(data.signedByCapacity);
  const userUid = asString(data.userUid);
  const signedAt = toIsoDate(data.signedAt);
  const acknowledgementVersion = asString(data.acknowledgementVersion);

  if (!signatureText || !signedByName || !signedByCapacity || !userUid || !signedAt || !acknowledgementVersion) {
    return null;
  }

  if (data.acceptedTerms !== true || data.authorityConfirmed !== true) {
    return null;
  }

  return {
    id,
    contractorId,
    userUid,
    signatureText,
    signedByName,
    signedByCapacity,
    acceptedTerms: true,
    authorityConfirmed: true,
    acknowledgementVersion,
    signedAt,
    ipAddress: asString(data.ipAddress),
    userAgent: asString(data.userAgent),
    status: "valid",
  };
}

export async function createContractorAcknowledgement(input: {
  contractorId: string;
  userUid: string;
  signatureText: string;
  signedByName: string;
  signedByCapacity: string;
  acceptedTerms: boolean;
  authorityConfirmed: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  acknowledgementVersion?: string;
}): Promise<ContractorAcknowledgementRecord> {
  const contractorId = input.contractorId.trim();
  const userUid = input.userUid.trim();
  const signatureText = input.signatureText.trim();
  const signedByName = input.signedByName.trim();
  const signedByCapacity = input.signedByCapacity.trim();
  const acknowledgementVersion = (input.acknowledgementVersion ?? CONTRACTOR_ACKNOWLEDGEMENT_VERSION).trim();

  if (!contractorId || !userUid || !signatureText || !signedByName || !signedByCapacity) {
    throw new Error("Missing acknowledgement signature fields");
  }

  if (!input.acceptedTerms || !input.authorityConfirmed) {
    throw new Error("Terms and authority confirmation are required");
  }

  const now = new Date();
  const ref = getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("acknowledgements")
    .doc();

  await ref.set({
    contractorId,
    userUid,
    signatureText,
    signedByName,
    signedByCapacity,
    acceptedTerms: true,
    authorityConfirmed: true,
    acknowledgementVersion,
    signedAt: now,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    id: ref.id,
    contractorId,
    userUid,
    signatureText,
    signedByName,
    signedByCapacity,
    acceptedTerms: true,
    authorityConfirmed: true,
    acknowledgementVersion,
    signedAt: now.toISOString(),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    status: "valid",
  };
}

export async function getLatestContractorAcknowledgement(
  contractorId: string,
): Promise<ContractorAcknowledgementRecord | null> {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("acknowledgements")
    .orderBy("signedAt", "desc")
    .limit(5)
    .get();

  for (const doc of snapshot.docs) {
    const normalized = normalizeAcknowledgement(doc.id, contractorId, (doc.data() ?? {}) as Record<string, unknown>);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export async function getLatestValidContractorSignature(
  contractorId: string,
): Promise<ContractorSignaturePayload | null> {
  const acknowledgement = await getLatestContractorAcknowledgement(contractorId);
  if (!acknowledgement) {
    return null;
  }

  return {
    contractorId: acknowledgement.contractorId,
    acknowledgementId: acknowledgement.id,
    signatureText: acknowledgement.signatureText,
    signedByName: acknowledgement.signedByName,
    signedByCapacity: acknowledgement.signedByCapacity,
    signedAt: acknowledgement.signedAt,
    acknowledgementVersion: acknowledgement.acknowledgementVersion,
    userUid: acknowledgement.userUid,
  };
}

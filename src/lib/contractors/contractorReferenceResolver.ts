import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";

export type ContractorReferenceType =
  | "firestore_document_id"
  | "contractorId_field"
  | "uid_field"
  | "authUid_field"
  | "userId_field"
  | "user_profile_id"
  | "user_profile_contractorId"
  | "contractor_profile_id"
  | "contractor_profile_contractorId";

export type ContractorReferenceFailure =
  | "missing_reference"
  | "not_found"
  | "ambiguous_reference"
  | "cross_workspace"
  | "unauthorized_contractor";

export interface ResolvedContractorReference {
  ok: true;
  storedReference: string;
  referenceType: ContractorReferenceType;
  contractorId: string;
  workspaceId: string | null;
  contractor: Record<string, unknown> & { id: string };
}

export interface FailedContractorReference {
  ok: false;
  storedReference: string;
  referenceType: ContractorReferenceType | "unknown" | null;
  failureReason: ContractorReferenceFailure;
  candidateIds: string[];
}

export type ContractorReferenceResolution = ResolvedContractorReference | FailedContractorReference;

interface ContractorCandidate {
  id: string;
  data: Record<string, unknown>;
  referenceType: ContractorReferenceType;
}

interface ResolveContractorReferenceInput {
  reference: string | null | undefined;
  expectedWorkspaceId?: string | null;
  actor?: Pick<AuthorizedUser, "role" | "contractorId"> | null;
  dealId?: string | null;
  logContext?: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isPrivilegedRole(role: string | undefined): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

function getWorkspaceId(data: Record<string, unknown>): string | null {
  const workspace = data.workspace && typeof data.workspace === "object"
    ? (data.workspace as Record<string, unknown>)
    : null;
  return asString(data.workspaceId) ?? asString(workspace?.id) ?? null;
}

function logContractorResolution(details: {
  dealId?: string | null;
  storedReference: string;
  referenceType: string | null;
  resolvedContractorId?: string | null;
  resolvedWorkspaceId?: string | null;
  lookupResult: "resolved" | "failed";
  failureReason?: string | null;
  logContext?: string;
}) {
  console.info("[contractor-reference-resolver]", {
    dealId: details.dealId ?? null,
    storedContractorReference: details.storedReference,
    referenceTypeDetected: details.referenceType,
    resolvedContractorDocumentId: details.resolvedContractorId ?? null,
    resolvedWorkspaceId: details.resolvedWorkspaceId ?? null,
    lookupResult: details.lookupResult,
    failureReason: details.failureReason ?? null,
    context: details.logContext ?? null,
  });
}

function logAmbiguousReference(storedReference: string, candidateIds: string[], dealId?: string | null) {
  console.warn("[contractor-reference-resolver] ambiguous_reference", {
    dealId: dealId ?? null,
    storedContractorReference: storedReference,
    candidateIds,
  });
}

async function addContractorDocCandidate(
  candidates: Map<string, ContractorCandidate>,
  id: string | null,
  referenceType: ContractorReferenceType,
) {
  if (!id || candidates.has(id)) {
    return;
  }

  const snapshot = await getFirebaseAdmin().collection("contractors").doc(id).get();
  if (snapshot.exists) {
    candidates.set(snapshot.id, {
      id: snapshot.id,
      data: (snapshot.data() ?? {}) as Record<string, unknown>,
      referenceType,
    });
  }
}

async function addContractorFieldCandidates(
  candidates: Map<string, ContractorCandidate>,
  field: "contractorId" | "uid" | "authUid" | "userId",
  value: string,
  referenceType: ContractorReferenceType,
) {
  const snapshot = await getFirebaseAdmin().collection("contractors").where(field, "==", value).limit(3).get();
  for (const doc of snapshot.docs) {
    if (!candidates.has(doc.id)) {
      candidates.set(doc.id, {
        id: doc.id,
        data: (doc.data() ?? {}) as Record<string, unknown>,
        referenceType,
      });
    }
  }
}

async function addProfileCandidates(
  candidates: Map<string, ContractorCandidate>,
  collectionName: "users" | "contractorProfiles",
  reference: string,
) {
  const profileSnapshot = await getFirebaseAdmin().collection(collectionName).doc(reference).get();
  const idReferenceType = collectionName === "users" ? "user_profile_id" : "contractor_profile_id";
  const fieldReferenceType = collectionName === "users" ? "user_profile_contractorId" : "contractor_profile_contractorId";

  if (profileSnapshot.exists) {
    const profile = (profileSnapshot.data() ?? {}) as Record<string, unknown>;
    await addContractorDocCandidate(candidates, asString(profile.contractorId), fieldReferenceType);
    await addContractorDocCandidate(candidates, asString(profile.uid), idReferenceType);
  }

  const contractorProfileQuery = await getFirebaseAdmin()
    .collection(collectionName)
    .where("contractorId", "==", reference)
    .limit(3)
    .get();

  for (const doc of contractorProfileQuery.docs) {
    const profile = (doc.data() ?? {}) as Record<string, unknown>;
    await addContractorDocCandidate(candidates, asString(profile.contractorId), fieldReferenceType);
  }
}

function fail(
  storedReference: string,
  failureReason: ContractorReferenceFailure,
  candidateIds: string[],
  referenceType: ContractorReferenceType | "unknown" | null,
  input: ResolveContractorReferenceInput,
): FailedContractorReference {
  logContractorResolution({
    dealId: input.dealId,
    storedReference,
    referenceType,
    lookupResult: "failed",
    failureReason,
    logContext: input.logContext,
  });

  return {
    ok: false,
    storedReference,
    referenceType,
    failureReason,
    candidateIds,
  };
}

export async function resolveContractorReference(
  input: ResolveContractorReferenceInput,
): Promise<ContractorReferenceResolution> {
  const storedReference = asString(input.reference);
  if (!storedReference) {
    return fail("", "missing_reference", [], null, input);
  }

  const candidates = new Map<string, ContractorCandidate>();

  await addContractorDocCandidate(candidates, storedReference, "firestore_document_id");
  await addContractorFieldCandidates(candidates, "contractorId", storedReference, "contractorId_field");
  await addContractorFieldCandidates(candidates, "uid", storedReference, "uid_field");
  await addContractorFieldCandidates(candidates, "authUid", storedReference, "authUid_field");
  await addContractorFieldCandidates(candidates, "userId", storedReference, "userId_field");
  await addProfileCandidates(candidates, "users", storedReference);
  await addProfileCandidates(candidates, "contractorProfiles", storedReference);

  const candidateList = [...candidates.values()];
  const candidateIds = candidateList.map((candidate) => candidate.id);

  if (candidateList.length === 0) {
    return fail(storedReference, "not_found", [], "unknown", input);
  }

  const expectedWorkspaceId = asString(input.expectedWorkspaceId);
  const workspaceSafeCandidates = expectedWorkspaceId
    ? candidateList.filter((candidate) => {
        const candidateWorkspaceId = getWorkspaceId(candidate.data);
        return !candidateWorkspaceId || candidateWorkspaceId === expectedWorkspaceId;
      })
    : candidateList;

  if (workspaceSafeCandidates.length === 0) {
    return fail(storedReference, "cross_workspace", candidateIds, candidateList[0]?.referenceType ?? "unknown", input);
  }

  if (workspaceSafeCandidates.length > 1) {
    logAmbiguousReference(storedReference, workspaceSafeCandidates.map((candidate) => candidate.id), input.dealId);
    return fail(
      storedReference,
      "ambiguous_reference",
      workspaceSafeCandidates.map((candidate) => candidate.id),
      "unknown",
      input,
    );
  }

  const candidate = workspaceSafeCandidates[0];
  if (
    input.actor?.role === "contractor" &&
    !isPrivilegedRole(input.actor.role) &&
    input.actor.contractorId !== candidate.id
  ) {
    return fail(storedReference, "unauthorized_contractor", [candidate.id], candidate.referenceType, input);
  }

  const workspaceId = getWorkspaceId(candidate.data);
  logContractorResolution({
    dealId: input.dealId,
    storedReference,
    referenceType: candidate.referenceType,
    resolvedContractorId: candidate.id,
    resolvedWorkspaceId: workspaceId,
    lookupResult: "resolved",
    logContext: input.logContext,
  });

  return {
    ok: true,
    storedReference,
    referenceType: candidate.referenceType,
    contractorId: candidate.id,
    workspaceId,
    contractor: {
      id: candidate.id,
      ...candidate.data,
    },
  };
}

export function getContractorBusinessName(contractor: Record<string, unknown>): string {
  return (
    asString(contractor.companyName) ??
    asString(contractor.company) ??
    asString(contractor.name) ??
    asString(contractor.tradingName) ??
    "Linked contractor"
  );
}


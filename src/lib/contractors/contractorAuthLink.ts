import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  normalizeContractorId,
  normalizeRole,
  resolveRole,
  type UserProfile,
} from "@/lib/auth/userProfile";
import type { UserRole } from "@/lib/auth/roleUtils";

interface ContractorCandidate {
  id: string;
  data: Record<string, unknown>;
  source: string;
}

export interface EnsureContractorAuthLinkageInput {
  uid: string;
  source: string;
  decodedRole?: unknown;
  decodedContractorId?: unknown;
  decodedEmail?: unknown;
  allowCreateMissingContractor?: boolean;
  authUser?: UserRecord;
  profile?: UserProfile | null;
}

export interface EnsureContractorAuthLinkageResult {
  uid: string;
  role: UserRole;
  contractorId?: string;
  profileExists: boolean;
  contractorProfileExists: boolean;
  contractorProfileCreated: boolean;
  repairApplied: boolean;
  mismatches: string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildLogPayload(
  input: EnsureContractorAuthLinkageInput,
  details: Record<string, unknown>,
): Record<string, unknown> {
  return {
    source: input.source,
    uid: input.uid,
    ...details,
  };
}

function logWarning(event: string, input: EnsureContractorAuthLinkageInput, details: Record<string, unknown>) {
  console.warn(`[contractor-linkage] ${event}`, buildLogPayload(input, details));
}

function logError(event: string, input: EnsureContractorAuthLinkageInput, error: unknown) {
  console.error(`[contractor-linkage] ${event}`, buildLogPayload(input, { error }));
}

async function findCandidateByField(
  field: string,
  value: string | undefined,
): Promise<ContractorCandidate[]> {
  if (!value) {
    return [];
  }

  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .where(field, "==", value)
    .limit(2)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: (doc.data() ?? {}) as Record<string, unknown>,
    source: field,
  }));
}

async function resolveCandidates(params: {
  preferredContractorId?: string;
  uid: string;
  email?: string;
}): Promise<ContractorCandidate[]> {
  const db = getFirebaseAdmin();
  const candidates = new Map<string, ContractorCandidate>();

  const directIds = [params.preferredContractorId, params.uid]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  for (const contractorId of directIds) {
    const snapshot = await db.collection("contractors").doc(contractorId).get();
    if (snapshot.exists) {
      candidates.set(contractorId, {
        id: snapshot.id,
        data: (snapshot.data() ?? {}) as Record<string, unknown>,
        source: contractorId === params.preferredContractorId ? "preferredContractorId" : "uid",
      });
    }
  }

  if (candidates.size > 0) {
    return [...candidates.values()];
  }

  const queryCandidates = await Promise.all([
    findCandidateByField("authUid", params.uid),
    findCandidateByField("userId", params.uid),
    findCandidateByField("email", params.email),
    findCandidateByField("contactEmail", params.email),
  ]);

  for (const group of queryCandidates) {
    for (const candidate of group) {
      if (!candidates.has(candidate.id)) {
        candidates.set(candidate.id, candidate);
      }
    }
  }

  return [...candidates.values()];
}

function chooseCanonicalContractorId(params: {
  preferredContractorId?: string;
  uid: string;
  candidates: ContractorCandidate[];
  mismatches: string[];
}): string | undefined {
  const { preferredContractorId, uid, candidates, mismatches } = params;

  if (preferredContractorId && candidates.some((candidate) => candidate.id === preferredContractorId)) {
    return preferredContractorId;
  }

  if (candidates.some((candidate) => candidate.id === uid)) {
    if (preferredContractorId && preferredContractorId !== uid) {
      mismatches.push("preferredContractorId_missing_fell_back_to_uid");
    }
    return uid;
  }

  if (candidates.length === 1) {
    const [candidate] = candidates;
    if (preferredContractorId && preferredContractorId !== candidate.id) {
      mismatches.push("preferredContractorId_mismatch");
    }
    return candidate.id;
  }

  if (candidates.length > 1) {
    mismatches.push("ambiguous_contractor_mapping");
  }

  return preferredContractorId ?? uid;
}

function buildMissingContractorPayload(params: {
  contractorId: string;
  uid: string;
  profile: UserProfile | null;
  authUser: UserRecord | null;
}): Record<string, unknown> {
  const now = Date.now();
  const updatedAt = new Date(now).toISOString();
  const email =
    asString(params.profile?.email) ??
    asString(params.authUser?.email) ??
    undefined;
  const displayName =
    asString(params.profile?.name) ??
    asString(params.authUser?.displayName) ??
    email ??
    params.contractorId;

  return {
    id: params.contractorId,
    contractorId: params.contractorId,
    uid: params.uid,
    authUid: params.uid,
    userId: params.uid,
    email: email ?? null,
    contactEmail: email ?? null,
    name: displayName,
    companyName: displayName,
    contactPerson: displayName,
    status: params.profile?.status ?? "pending",
    createdAt: typeof params.profile?.createdAt === "number" ? params.profile.createdAt : now,
    updatedAt,
    complianceApproved: false,
  };
}

export async function ensureContractorAuthLinkage(
  input: EnsureContractorAuthLinkageInput,
): Promise<EnsureContractorAuthLinkageResult> {
  const db = getFirebaseAdmin();
  const auth = getAuth();
  const mismatches: string[] = [];
  let repairApplied = false;
  let contractorProfileCreated = false;

  const authUser = input.authUser ?? (await auth.getUser(input.uid).catch((error) => {
    logError("auth_user_lookup_failed", input, error);
    return null;
  }));

  const userSnapshot = input.profile
    ? null
    : await db.collection("users").doc(input.uid).get();
  const profile =
    input.profile ??
    (userSnapshot?.exists
      ? ({
          name: asString(userSnapshot.data()?.name),
          email: asString(userSnapshot.data()?.email),
          role: normalizeRole(userSnapshot.data()?.role),
          status: asString(userSnapshot.data()?.status),
          contractorId: normalizeContractorId(userSnapshot.data()?.contractorId),
          createdAt: userSnapshot.data()?.createdAt,
        } as UserProfile)
      : null);

  const role = resolveRole(
    profile?.role,
    input.decodedRole ?? authUser?.customClaims?.role,
  );

  const currentClaimContractorId = normalizeContractorId(
    input.decodedContractorId ?? authUser?.customClaims?.contractorId,
  );
  const preferredContractorId =
    normalizeContractorId(profile?.contractorId) ??
    currentClaimContractorId ??
    (role === "contractor" ? input.uid : undefined);

  if (role !== "contractor") {
    return {
      uid: input.uid,
      role,
      contractorId: preferredContractorId,
      profileExists: Boolean(profile),
      contractorProfileExists: false,
      contractorProfileCreated: false,
      repairApplied: false,
      mismatches,
    };
  }

  if (!profile) {
    mismatches.push("missing_user_profile");
    logWarning("orphaned_user", input, {
      role,
      preferredContractorId: preferredContractorId ?? null,
    });
  }

  const email =
    asString(profile?.email) ??
    asString(authUser?.email) ??
    asString(input.decodedEmail);
  const candidates = await resolveCandidates({
    preferredContractorId,
    uid: input.uid,
    email,
  });
  const canonicalContractorId = chooseCanonicalContractorId({
    preferredContractorId,
    uid: input.uid,
    candidates,
    mismatches,
  });

  if (!canonicalContractorId) {
    throw new Error("Unable to resolve contractor linkage");
  }

  const contractorSnapshot = await db.collection("contractors").doc(canonicalContractorId).get();
  let contractorProfileExists = contractorSnapshot.exists;
  const contractorData = contractorSnapshot.exists
    ? ((contractorSnapshot.data() ?? {}) as Record<string, unknown>)
    : null;

  if (!contractorProfileExists) {
    logWarning("missing_contractor_profile", input, {
      preferredContractorId: preferredContractorId ?? null,
      canonicalContractorId,
      email: email ?? null,
    });
  }

  if (preferredContractorId && preferredContractorId !== canonicalContractorId) {
    logWarning("mismatched_contractor_mapping", input, {
      preferredContractorId,
      canonicalContractorId,
      email: email ?? null,
    });
  }

  if (!profile || profile.contractorId !== canonicalContractorId) {
    const createdAt =
      typeof profile?.createdAt === "number"
        ? profile.createdAt
        : Date.now();

    await db.collection("users").doc(input.uid).set(
      {
        uid: input.uid,
        name: profile?.name ?? authUser?.displayName ?? email ?? canonicalContractorId,
        email: email ?? null,
        role,
        contractorId: canonicalContractorId,
        status: profile?.status ?? null,
        createdAt,
      },
      { merge: true },
    );
    repairApplied = true;
  }

  const currentRole = normalizeRole(authUser?.customClaims?.role);
  const currentContractorId = normalizeContractorId(authUser?.customClaims?.contractorId);
  if (authUser && (currentRole !== role || currentContractorId !== canonicalContractorId)) {
    await auth.setCustomUserClaims(input.uid, {
      role,
      contractorId: canonicalContractorId,
    });
    repairApplied = true;
  }

  if (!contractorProfileExists && input.allowCreateMissingContractor !== false) {
    if (mismatches.includes("ambiguous_contractor_mapping")) {
      throw new Error("Ambiguous contractor mapping prevented contractor profile repair");
    }

    await db.collection("contractors").doc(canonicalContractorId).set(
      buildMissingContractorPayload({
        contractorId: canonicalContractorId,
        uid: input.uid,
        profile,
        authUser,
      }),
      { merge: true },
    );
    contractorProfileExists = true;
    contractorProfileCreated = true;
    repairApplied = true;
  }

  const contractorNeedsLinkagePatch =
    contractorProfileExists &&
    (
      asString(contractorData?.id) !== canonicalContractorId ||
      normalizeContractorId(contractorData?.contractorId) !== canonicalContractorId ||
      normalizeContractorId(contractorData?.authUid) !== input.uid ||
      normalizeContractorId(contractorData?.userId) !== input.uid
    );

  if (contractorNeedsLinkagePatch) {
    await db.collection("contractors").doc(canonicalContractorId).set(
      {
        id: canonicalContractorId,
        contractorId: canonicalContractorId,
        authUid: input.uid,
        userId: input.uid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    repairApplied = true;
  }

  return {
    uid: input.uid,
    role,
    contractorId: canonicalContractorId,
    profileExists: Boolean(profile),
    contractorProfileExists,
    contractorProfileCreated,
    repairApplied,
    mismatches,
  };
}

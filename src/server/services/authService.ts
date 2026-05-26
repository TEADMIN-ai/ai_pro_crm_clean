import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeContractorId, normalizeRole, resolveRole, type UserProfile } from "@/lib/auth/userProfile";
import { ensureContractorAuthLinkage } from "@/lib/contractors/contractorAuthLink";
import { verifySessionValue } from "@/lib/server/verifySession";
import type { UserRole } from "@/lib/auth/roleUtils";

export interface BootstrapUser {
  uid: string;
  email?: string;
  role: UserRole;
  contractorId?: string;
  status?: string;
  name?: string;
  createdAt?: unknown;
}

function toUserProfile(data: Record<string, unknown>): UserProfile {
  return {
    name: typeof data.name === "string" ? data.name : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    role: normalizeRole(data.role),
    status: typeof data.status === "string" ? data.status : undefined,
    contractorId: normalizeContractorId(data.contractorId),
    createdAt: data.createdAt,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  return toUserProfile((snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function syncUserClaims(idToken: string) {
  const adminAuth = getAuth();
  const db = getFirebaseAdmin();
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
  const userRecord = await adminAuth.getUser(uid);
  const currentRole = normalizeRole(userRecord.customClaims?.role);
  const currentContractorId = normalizeContractorId(userRecord.customClaims?.contractorId);
  const role = userDoc.exists ? resolveRole(userData.role, currentRole) : currentRole;
  const contractorId = userDoc.exists
    ? normalizeContractorId(userData.contractorId) ?? currentContractorId
    : currentContractorId;

  if (role === "guest") {
    throw new Error("User role could not be resolved");
  }

  const linkage =
    role === "contractor"
      ? await ensureContractorAuthLinkage({
          uid,
          source: "authService.syncUserClaims",
          decodedRole: role,
          decodedContractorId: contractorId,
          decodedEmail: decodedToken.email,
          authUser: userRecord,
          profile: userDoc.exists ? toUserProfile(userData) : null,
          allowCreateMissingContractor: true,
        })
      : null;
  const resolvedContractorId = linkage?.contractorId ?? contractorId;

  if (currentRole !== role || currentContractorId !== resolvedContractorId) {
    await adminAuth.setCustomUserClaims(uid, {
      role,
      contractorId: resolvedContractorId ?? null,
    });
  }

  return {
    uid,
    role,
    contractorId: resolvedContractorId ?? null,
  };
}

export async function createSessionCookie(idToken: string) {
  const auth = getAuth();
  const decodedToken = await auth.verifyIdToken(idToken);
  const expiresIn = 5 * 24 * 60 * 60 * 1000;
  const maxAge = 5 * 24 * 60 * 60;
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn,
  });

  return {
    sessionCookie,
    maxAge,
    uid: decodedToken.uid,
  };
}

async function decodeBootstrapToken(input: {
  sessionCookie?: string;
}): Promise<DecodedIdToken | null> {
  if (input.sessionCookie) {
    return verifySessionValue(input.sessionCookie);
  }

  return null;
}

export async function getBootstrapUser(input: {
  sessionCookie?: string;
}): Promise<BootstrapUser | null> {
  const decoded = await decodeBootstrapToken(input);
  if (!decoded) {
    return null;
  }

  const profile = await getUserProfile(decoded.uid);
  const role = resolveRole(profile?.role, decoded.role);
  const contractorId = profile?.contractorId ?? normalizeContractorId(decoded.contractorId);

  return {
    uid: decoded.uid,
    email: profile?.email ?? (typeof decoded.email === "string" ? decoded.email : undefined),
    name: profile?.name ?? (typeof decoded.name === "string" ? decoded.name : undefined),
    role,
    contractorId,
    status: profile?.status,
    createdAt: profile?.createdAt,
  };
}

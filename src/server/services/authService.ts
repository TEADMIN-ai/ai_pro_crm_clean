import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeContractorId, normalizeRole, type UserProfile } from "@/lib/auth/userProfile";
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
  const adminAuth = getAdminAuth();
  const db = getFirebaseAdmin();
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
  const role = userDoc.exists ? normalizeRole(userData.role) : "guest";
  const contractorId = userDoc.exists ? normalizeContractorId(userData.contractorId) : undefined;

  const userRecord = await adminAuth.getUser(uid);
  const currentRole = userRecord.customClaims?.role;
  const currentContractorId = normalizeContractorId(userRecord.customClaims?.contractorId);

  if (currentRole !== role || currentContractorId !== contractorId) {
    await adminAuth.setCustomUserClaims(uid, {
      role,
      contractorId: contractorId ?? null,
    });
  }

  return {
    uid,
    role,
    contractorId: contractorId ?? null,
  };
}

export async function createSessionCookie(idToken: string) {
  const auth = getAdminAuth();
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
  bearerToken?: string;
  sessionCookie?: string;
}): Promise<DecodedIdToken | null> {
  if (input.bearerToken) {
    return getAdminAuth().verifyIdToken(input.bearerToken);
  }

  if (input.sessionCookie) {
    return verifySessionValue(input.sessionCookie);
  }

  return null;
}

export async function getBootstrapUser(input: {
  bearerToken?: string;
  sessionCookie?: string;
}): Promise<BootstrapUser | null> {
  const decoded = await decodeBootstrapToken(input);
  if (!decoded) {
    return null;
  }

  const profile = await getUserProfile(decoded.uid);
  const role = profile?.role ?? normalizeRole(decoded.role);
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

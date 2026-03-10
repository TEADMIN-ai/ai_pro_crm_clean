import { getAuth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";
import { db } from "@/lib/firebase/admin";
import { normalizeContractorId, normalizeRole, type UserProfile } from "@/lib/auth/userProfile";
import type { UserRole } from "@/lib/auth/roleUtils";

export interface AuthorizedUser {
  uid: string;
  email?: string;
  role: UserRole;
  contractorId?: string;
}

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

function getBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token) {
    throw new AuthorizationError("unauthorized", 401);
  }

  return token;
}

async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await db.collection("users").doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  return {
    name: typeof data.name === "string" ? data.name : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    role: normalizeRole(data.role),
    status: typeof data.status === "string" ? data.status : undefined,
    contractorId: normalizeContractorId(data.contractorId),
    createdAt: data.createdAt,
  };
}

export async function requireAuthorizedUser(request: NextRequest): Promise<AuthorizedUser> {
  const token = getBearerToken(request);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const profile = await getUserProfile(decoded.uid);

    const role = profile?.role ?? normalizeRole(decoded.role);
    const contractorId = profile?.contractorId ?? normalizeContractorId(decoded.contractorId);

    if (role === "contractor" && !contractorId) {
      throw new AuthorizationError("unauthorized", 403);
    }

    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      role,
      contractorId,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new AuthorizationError("unauthorized", 401);
  }
}

export function canAccessContractor(user: AuthorizedUser, contractorId: string): boolean {
  if (user.role === "admin" || user.role === "manager" || user.role === "staff") {
    return true;
  }

  if (user.role !== "contractor") {
    return false;
  }

  return Boolean(user.contractorId) && user.contractorId === contractorId;
}

export function assertOperationalRole(user: AuthorizedUser): void {
  if (user.role === "guest") {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export function assertPrivilegedRole(user: AuthorizedUser): void {
  if (!isPrivilegedRole(user.role)) {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export function assertCanAccessContractor(user: AuthorizedUser, contractorId: string): void {
  if (!canAccessContractor(user, contractorId)) {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export function isPrivilegedRole(role: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

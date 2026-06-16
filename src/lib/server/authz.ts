import type { NextRequest } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeContractorId, normalizeRole, resolveRole, type UserProfile } from "@/lib/auth/userProfile";
import { ensureContractorAuthLinkage } from "@/lib/contractors/contractorAuthLink";
import type { UserRole } from "@/lib/auth/roleUtils";
import { isVehicleFinanceRole, isVehicleFinanceStaffRole } from "@/lib/auth/roleUtils";
import { requireAuth } from "@/lib/server/requireAuth";

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

async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
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

export interface ResolvedIdentity {
  uid: string;
  email?: string;
  role: UserRole;
  contractorId?: string;
  profile: UserProfile | null;
}

export async function resolveAuthorizedIdentity(args: {
  uid: string;
  email?: string;
  role?: unknown;
  contractorId?: unknown;
  profile?: UserProfile | null;
}): Promise<ResolvedIdentity> {
  const profile = args.profile ?? (await getUserProfile(args.uid));
  const role = resolveRole(profile?.role, args.role);
  const contractorId = profile?.contractorId ?? normalizeContractorId(args.contractorId);

  if (!role || role === "guest") {
    throw new AuthorizationError("Invalid role", 403);
  }

  return {
    uid: args.uid,
    email: args.email,
    role,
    contractorId,
    profile,
  };
}

export async function requireAuthorizedUser(request: NextRequest): Promise<AuthorizedUser> {
  try {
    const decoded = await requireAuth(request);

    if (!decoded) {
      throw new AuthorizationError("unauthorized", 401);
    }

    const resolved = await resolveAuthorizedIdentity({
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      role: decoded.role,
      contractorId: decoded.contractorId,
    });

    const linkage =
      resolved.role === "contractor"
        ? await ensureContractorAuthLinkage({
            uid: resolved.uid,
            source: "authz.requireAuthorizedUser",
            decodedRole: resolved.role,
            decodedContractorId: resolved.contractorId,
            decodedEmail: resolved.email,
            profile: resolved.profile,
            allowCreateMissingContractor: true,
          })
        : null;
    const resolvedContractorId = linkage?.contractorId ?? resolved.contractorId;

    if (resolved.role === "contractor" && !resolvedContractorId) {
      throw new AuthorizationError("unauthorized", 403);
    }

    return {
      uid: resolved.uid,
      email: resolved.email,
      role: resolved.role,
      contractorId: resolvedContractorId,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    console.error("Authorization failed", error);
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

export function isVehicleFinanceAuthorizedRole(role: UserRole): boolean {
  return isPrivilegedRole(role) || isVehicleFinanceRole(role);
}

export function assertVehicleFinanceRole(user: AuthorizedUser): void {
  if (!isVehicleFinanceAuthorizedRole(user.role)) {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export function assertVehicleFinanceStaffRole(user: AuthorizedUser): void {
  if (!isVehicleFinanceStaffRole(user.role)) {
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

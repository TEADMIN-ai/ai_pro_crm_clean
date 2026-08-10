import type { AuthorizedUser } from "@/lib/server/authz";
import type {
  CanonicalMasterEntity,
  MasterDataActor,
  MasterDataEntityType,
  MasterDataVerificationStatus,
} from "@/types/masterData";

export const MASTER_DATA_ENTITY_TYPES: readonly MasterDataEntityType[] = ["client", "supplier", "site", "employee", "item", "source", "document"];

export function isMasterDataEntityType(value: unknown): value is MasterDataEntityType {
  return MASTER_DATA_ENTITY_TYPES.includes(value as MasterDataEntityType);
}

export function actorFromAuthorizedUser(user: AuthorizedUser, workspaceId?: string | null): MasterDataActor {
  return {
    uid: user.uid,
    role: user.role,
    email: user.email ?? null,
    workspaceId: workspaceId ?? user.workspaceId ?? null,
  };
}

export function parseMasterDataEntityPayload(value: unknown): CanonicalMasterEntity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Master Data payload must be an object."), { status: 400 });
  }
  const entity = value as Partial<CanonicalMasterEntity>;
  if (!isMasterDataEntityType(entity.entityType)) {
    throw Object.assign(new Error("Unsupported Master Data entity type."), { status: 400 });
  }
  if (typeof entity.canonicalId !== "string" || !entity.canonicalId.trim()) {
    throw Object.assign(new Error("canonicalId is required."), { status: 400 });
  }
  if (typeof entity.workspaceId !== "string" || !entity.workspaceId.trim()) {
    throw Object.assign(new Error("workspaceId is required."), { status: 400 });
  }
  return entity as CanonicalMasterEntity;
}

export function parsePatchPayload(value: unknown): Partial<CanonicalMasterEntity> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Patch payload must be an object."), { status: 400 });
  }
  return value as Partial<CanonicalMasterEntity>;
}

export function assertPatchMatchesRouteIdentity(input: {
  entityType: MasterDataEntityType;
  canonicalId: string;
  patch: Partial<CanonicalMasterEntity>;
}): void {
  if (typeof input.patch.entityType === "string" && input.patch.entityType !== input.entityType) {
    throw Object.assign(new Error("Patch entityType must match the route entityType."), { status: 400 });
  }
  if (typeof input.patch.canonicalId === "string" && input.patch.canonicalId !== input.canonicalId) {
    throw Object.assign(new Error("Patch canonicalId must match the route canonicalId."), { status: 400 });
  }
}

export function verificationPatch(status: MasterDataVerificationStatus, actorUid: string): Partial<CanonicalMasterEntity> {
  return {
    verificationStatus: status,
    reviewStatus: status === "VERIFIED" ? "READY_FOR_USE" : status === "REJECTED" ? "BLOCKED" : status === "ARCHIVED" ? "ARCHIVED" : "REVIEW_REQUIRED",
    updatedBy: actorUid,
  } as Partial<CanonicalMasterEntity>;
}

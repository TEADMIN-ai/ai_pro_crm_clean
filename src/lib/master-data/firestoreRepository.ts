import { FieldPath } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeIdentityKey } from "@/lib/master-data/policy";
import type {
  CanonicalMasterEntity,
  MasterDataAuditEvent,
  MasterDataEntityType,
} from "@/types/masterData";

export const MASTER_DATA_COLLECTIONS = {
  client: "masterClients",
  supplier: "masterSuppliers",
  site: "masterSites",
  item: "masterItems",
  source: "masterSources",
  document: "masterDocuments",
  employee: "masterEmployees",
  contractor: "contractors",
  audit: "masterDataAuditEvents",
} as const satisfies Record<MasterDataEntityType | "audit", string>;

export type MasterDataIdentityLookup = {
  canonicalId?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
};

export class FirestoreMasterDataRepository {
  constructor(private readonly db = getFirebaseAdmin()) {}

  collectionName(entityType: MasterDataEntityType): string {
    return MASTER_DATA_COLLECTIONS[entityType];
  }

  async getByCanonicalId(entityType: MasterDataEntityType, canonicalId: string): Promise<CanonicalMasterEntity | null> {
    const snapshot = await this.db.collection(this.collectionName(entityType)).doc(canonicalId).get();
    return snapshot.exists ? snapshot.data() as CanonicalMasterEntity : null;
  }

  async listByEntityType(entityType: MasterDataEntityType, workspaceId: string): Promise<CanonicalMasterEntity[]> {
    const snapshot = await this.db
      .collection(this.collectionName(entityType))
      .where("workspaceId", "==", workspaceId)
      .limit(500)
      .get();
    return snapshot.docs.map((doc) => doc.data() as CanonicalMasterEntity);
  }

  async save(entity: CanonicalMasterEntity): Promise<void> {
    await this.db.collection(this.collectionName(entity.entityType)).doc(entity.canonicalId).set(entity, { merge: true });
  }

  async writeAuditEvent(event: MasterDataAuditEvent): Promise<void> {
    await this.db.collection(MASTER_DATA_COLLECTIONS.audit).doc(event.eventId).set(event);
  }

  async archive(entityType: MasterDataEntityType, canonicalId: string, patch: Partial<CanonicalMasterEntity>): Promise<void> {
    await this.db.collection(this.collectionName(entityType)).doc(canonicalId).set(patch, { merge: true });
  }

  async lookupIdentity(entityType: MasterDataEntityType, workspaceId: string, lookup: MasterDataIdentityLookup): Promise<CanonicalMasterEntity[]> {
    const candidates = new Map<string, CanonicalMasterEntity>();
    const collection = this.db.collection(this.collectionName(entityType));

    if (lookup.canonicalId) {
      const byId = await this.getByCanonicalId(entityType, lookup.canonicalId);
      if (byId && byId.workspaceId === workspaceId) candidates.set(byId.canonicalId, byId);
    }

    const exactFields: Array<[string, string | null | undefined]> = [
      ["registrationNumber", lookup.registrationNumber],
      ["email", lookup.email],
      ["phone", lookup.phone],
    ];
    for (const [field, value] of exactFields) {
      const clean = typeof value === "string" && value.trim() ? value.trim() : "";
      if (!clean) continue;
      const snapshot = await collection.where("workspaceId", "==", workspaceId).where(field, "==", clean).limit(20).get();
      snapshot.docs.forEach((doc) => candidates.set(doc.id, doc.data() as CanonicalMasterEntity));
    }

    const normalizedExactValues = {
      registrationNumber: normalizeIdentityKey(lookup.registrationNumber),
      email: normalizeIdentityKey(lookup.email),
      phone: normalizeIdentityKey(lookup.phone),
    };
    if (normalizedExactValues.registrationNumber || normalizedExactValues.email || normalizedExactValues.phone) {
      const workspaceRecords = await this.listByEntityType(entityType, workspaceId);
      workspaceRecords.forEach((entity) => {
        const record = entity as CanonicalMasterEntity & { registrationNumber?: unknown; email?: unknown; phone?: unknown };
        if (
          (normalizedExactValues.registrationNumber && normalizeIdentityKey(record.registrationNumber) === normalizedExactValues.registrationNumber) ||
          (normalizedExactValues.email && normalizeIdentityKey(record.email) === normalizedExactValues.email) ||
          (normalizedExactValues.phone && normalizeIdentityKey(record.phone) === normalizedExactValues.phone)
        ) {
          candidates.set(entity.canonicalId, entity);
        }
      });
    }

    const all = candidates.size > 0 ? Array.from(candidates.values()) : await this.listByEntityType(entityType, workspaceId);
    const nameKeys = [normalizeIdentityKey(lookup.legalName), normalizeIdentityKey(lookup.tradingName)].filter(Boolean);
    if (!nameKeys.length) return all;
    const byId = new Map<string, CanonicalMasterEntity>();
    all.forEach((entity) => {
      const keys = [
        normalizeIdentityKey(entity.legalName),
        normalizeIdentityKey(entity.tradingName),
        normalizeIdentityKey(entity.displayName),
      ];
      if (keys.some((key) => nameKeys.includes(key)) || candidates.has(entity.canonicalId)) {
        byId.set(entity.canonicalId, entity);
      }
    });
    return Array.from(byId.values());
  }

  async getManyByIds(entityType: MasterDataEntityType, ids: string[]): Promise<CanonicalMasterEntity[]> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return [];
    const chunks: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += 10) chunks.push(uniqueIds.slice(index, index + 10));
    const results: CanonicalMasterEntity[] = [];
    for (const chunk of chunks) {
      const snapshot = await this.db.collection(this.collectionName(entityType)).where(FieldPath.documentId(), "in", chunk).get();
      results.push(...snapshot.docs.map((doc) => doc.data() as CanonicalMasterEntity));
    }
    return results;
  }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getWorkspaceBySlug, toWorkspaceRegistrySummary } from "@/lib/workspaces/workspaceRegistry";

export type RecoveryMode = "dry-run" | "apply";
export type RecoveryAction = "plan" | "rollback";

type AnyRecord = Record<string, unknown>;

export type RecoveryTargetKey = "mackay" | "feMiller";

export type RecoveryTarget = {
  key: RecoveryTargetKey;
  contractorId: string;
  expectedNames: string[];
  evidence: string[];
};

export type RecoveryDocument = {
  path: string;
  id: string;
  exists: boolean;
  data: AnyRecord | null;
};

export type RecoveryMutation = {
  path: string;
  operation: "set";
  before: AnyRecord | null;
  after: AnyRecord;
  reason: string;
};

export type RecoveryPlan = {
  migrationId: typeof MIGRATION_ID;
  generatedAt: string;
  mode: RecoveryMode;
  projectId: string | null;
  targetWorkspace: ReturnType<typeof partnerWorkspace>;
  targets: RecoveryTarget[];
  evidence: string[];
  mutations: RecoveryMutation[];
  verification: RecoveryVerification;
};

export type RecoveryVerification = {
  contractorWorkspaceConsistent: boolean;
  userWorkspaceConsistent: boolean;
  contractorDocumentsAttached: boolean;
  relatedRecordsConsistent: boolean;
  duplicateContractorRecordsDetected: boolean;
  unrelatedRecordsPlanned: boolean;
  auditMetadataFirestoreSafe: boolean;
  idempotentAfterExpectedState: boolean;
  failures: string[];
};

export type RecoveryBackup = {
  schemaVersion: 1;
  migrationId: typeof MIGRATION_ID;
  action: "backup";
  createdAt: string;
  projectId: string | null;
  targetWorkspaceId: string;
  allowedContractorIds: string[];
  records: RecoveryDocument[];
  plannedMutations: RecoveryMutation[];
  metadata: AnyRecord;
};

export type FirestoreLike = {
  collection: (path: string) => CollectionLike;
  doc: (path: string) => DocumentReferenceLike;
  runTransaction?: <T>(fn: (transaction: TransactionLike) => Promise<T>) => Promise<T>;
};

export type CollectionLike = {
  doc: (id?: string) => DocumentReferenceLike;
  where?: (field: string, op: "==", value: unknown) => QueryLike;
  get?: () => Promise<QuerySnapshotLike>;
};

export type QueryLike = {
  get?: () => Promise<QuerySnapshotLike>;
  limit?: (limit: number) => QueryLike;
};

export type DocumentReferenceLike = {
  id?: string;
  path?: string;
  get?: () => Promise<DocumentSnapshotLike>;
  set?: (data: AnyRecord, options?: { merge?: boolean }) => Promise<unknown>;
};

export type DocumentSnapshotLike = {
  id: string;
  exists: boolean;
  ref?: DocumentReferenceLike;
  data: () => AnyRecord | undefined;
};

export type QuerySnapshotLike = {
  docs: DocumentSnapshotLike[];
  empty?: boolean;
  size?: number;
};

export type TransactionLike = {
  get: (ref: DocumentReferenceLike) => Promise<DocumentSnapshotLike>;
  set: (ref: DocumentReferenceLike, data: AnyRecord, options?: { merge?: boolean }) => TransactionLike;
};

export const MIGRATION_ID = "recover_mackay_fe_miller_workspace_v1";
export const APPLY_CONFIRMATION = "RECOVER_MACKAY_FE_MILLER";
export const BACKUP_DIR = "output/maintenance/contractor-workspace-recovery";

export const RECOVERY_TARGETS: RecoveryTarget[] = [
  {
    key: "mackay",
    contractorId: "VITBVkrgSdVMRshLn5WEVnmgqFO2",
    expectedNames: ["mackay and daughters enterprises"],
    evidence: [
      "reports/contractors/contractor-cleanup-report.json row: firestoreDocumentId=VITBVkrgSdVMRshLn5WEVnmgqFO2, businessCompanyName=Mackay and Daughters Enterprises, protected KEEP_ACTIVE, workspaceId=null",
      "output/maintenance/production-data-cleanup-report.json row: contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2, label=Mackay and Daughters Enterprises, references authUid/userId",
    ],
  },
  {
    key: "feMiller",
    contractorId: "s2crtIJSqFNe9ipkbgDNJoOvkLY2",
    expectedNames: ["f e miller pools", "f.e. miller pools", "fe miller pools"],
    evidence: [
      "reports/contractors/contractor-cleanup-report.json row: firestoreDocumentId=s2crtIJSqFNe9ipkbgDNJoOvkLY2, businessCompanyName=F E MILLER POOLS, protected KEEP_ACTIVE, workspaceId=null",
      "output/maintenance/production-data-cleanup-report.json row: contractors/s2crtIJSqFNe9ipkbgDNJoOvkLY2, label=F E MILLER POOLS, references authUid/userId",
    ],
  },
];

const RELATED_COLLECTIONS = [
  "deals",
  "submissionReviews",
  "tenderPacks",
  "tenderPackRequests",
  "contractorActivity",
  "contractorComplianceAudit",
  "automationAlerts",
  "documents",
] as const;

function partnerWorkspace() {
  const workspace = toWorkspaceRegistrySummary(getWorkspaceBySlug("partner"));
  if (!workspace) throw new Error("Partner workspace is missing from Workspace Registry.");
  return workspace;
}

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function canonicalName(value: unknown): string {
  return asString(value)?.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function docPath(ref: DocumentReferenceLike, fallback: string): string {
  return ref.path ?? fallback;
}

async function getDoc(db: FirestoreLike, path: string): Promise<RecoveryDocument> {
  const snap = await db.doc(path).get!();
  return {
    path,
    id: snap.id,
    exists: snap.exists,
    data: snap.exists ? clone(snap.data() ?? {}) : null,
  };
}

async function queryByContractorId(db: FirestoreLike, collection: string, contractorId: string): Promise<RecoveryDocument[]> {
  const query = db.collection(collection).where?.("contractorId", "==", contractorId).limit?.(100);
  if (!query?.get) return [];
  const snap = await query.get();
  return snap.docs.map((doc) => ({
    path: docPath(doc.ref ?? {}, `${collection}/${doc.id}`),
    id: doc.id,
    exists: doc.exists,
    data: doc.exists ? clone(doc.data() ?? {}) : null,
  }));
}

function targetForContractorId(contractorId: string): RecoveryTarget | null {
  return RECOVERY_TARGETS.find((target) => target.contractorId === contractorId) ?? null;
}

export function assertAllowlistedContractorId(contractorId: string): RecoveryTarget {
  const target = targetForContractorId(contractorId);
  if (!target) throw new Error(`Contractor ${contractorId} is not allowlisted for ${MIGRATION_ID}.`);
  return target;
}

function assertAllowedPath(path: string): void {
  const exact = RECOVERY_TARGETS.flatMap((target) => [
    `contractors/${target.contractorId}`,
    `users/${target.contractorId}`,
  ]);
  if (exact.includes(path)) return;

  const contractorSubcollectionAllowed = RECOVERY_TARGETS.some((target) => path.startsWith(`contractors/${target.contractorId}/documents/`));
  if (contractorSubcollectionAllowed) return;

  const relatedAllowed = RELATED_COLLECTIONS.some((collection) => path.startsWith(`${collection}/`));
  if (relatedAllowed) return;

  const workspaceMemberAllowed = path.startsWith("workspaceMembers/");
  if (workspaceMemberAllowed) return;

  throw new Error(`Path ${path} is outside the ${MIGRATION_ID} allowlist.`);
}

function getWorkspaceId(record: AnyRecord | null): string | null {
  const workspace = record?.workspace && typeof record.workspace === "object" ? record.workspace as AnyRecord : null;
  return asString(record?.workspaceId) ?? asString(workspace?.id);
}

function workspacePayload(reason: string): AnyRecord {
  const workspace = partnerWorkspace();
  return {
    workspace,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    updatedAt: nowIso(),
    migrationMetadata: firestoreSafe({
      migrationId: MIGRATION_ID,
      reason,
      migratedAt: nowIso(),
    }),
  };
}

function addMutation(mutations: RecoveryMutation[], document: RecoveryDocument, afterPatch: AnyRecord, reason: string) {
  assertAllowedPath(document.path);
  if (!document.exists) return;
  const after = { ...(document.data ?? {}), ...afterPatch };
  mutations.push({
    path: document.path,
    operation: "set",
    before: document.data,
    after,
    reason,
  });
}

function needsWorkspacePatch(document: RecoveryDocument, expectedWorkspaceId: string): boolean {
  if (!document.exists || !document.data) return false;
  return getWorkspaceId(document.data) !== expectedWorkspaceId || asString(document.data.workspaceSlug) !== "partner";
}

function assertIdentity(target: RecoveryTarget, contractor: RecoveryDocument, user: RecoveryDocument): void {
  if (!contractor.exists || !contractor.data) {
    throw new Error(`Missing contractor evidence at contractors/${target.contractorId}.`);
  }
  const contractorId = asString(contractor.data.contractorId) ?? contractor.id;
  if (contractorId !== target.contractorId || contractor.id !== target.contractorId) {
    throw new Error(`Contractor identity mismatch for ${target.key}.`);
  }
  const name = canonicalName(contractor.data.companyName ?? contractor.data.businessName ?? contractor.data.name ?? contractor.data.displayName);
  if (!target.expectedNames.some((expected) => name === canonicalName(expected))) {
    throw new Error(`Ambiguous contractor identity for ${target.key}; expected protected business name, found '${name || "missing"}'.`);
  }
  if (user.exists && user.data && asString(user.data.contractorId) !== target.contractorId) {
    throw new Error(`User profile users/${target.contractorId} does not point to contractor ${target.contractorId}.`);
  }
}

export async function collectRecoveryEvidence(db: FirestoreLike): Promise<RecoveryDocument[]> {
  const records = new Map<string, RecoveryDocument>();
  const put = (record: RecoveryDocument) => {
    assertAllowedPath(record.path);
    records.set(record.path, record);
  };

  for (const target of RECOVERY_TARGETS) {
    const contractor = await getDoc(db, `contractors/${target.contractorId}`);
    const user = await getDoc(db, `users/${target.contractorId}`);
    assertIdentity(target, contractor, user);
    put(contractor);
    put(user);

    const documentSnap = await db.collection(`contractors/${target.contractorId}/documents`).get?.();
    for (const doc of documentSnap?.docs ?? []) {
      put({
        path: docPath(doc.ref ?? {}, `contractors/${target.contractorId}/documents/${doc.id}`),
        id: doc.id,
        exists: doc.exists,
        data: doc.exists ? clone(doc.data() ?? {}) : null,
      });
    }

    for (const collection of RELATED_COLLECTIONS) {
      for (const record of await queryByContractorId(db, collection, target.contractorId)) put(record);
    }

    for (const field of ["contractorId", "userId"]) {
      const query = db.collection("workspaceMembers").where?.(field, "==", target.contractorId).limit?.(20);
      const snap = query?.get ? await query.get() : null;
      for (const doc of snap?.docs ?? []) {
        put({
          path: docPath(doc.ref ?? {}, `workspaceMembers/${doc.id}`),
          id: doc.id,
          exists: doc.exists,
          data: doc.exists ? clone(doc.data() ?? {}) : null,
        });
      }
    }
  }

  return [...records.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function buildRecoveryMutations(records: RecoveryDocument[]): RecoveryMutation[] {
  const mutations: RecoveryMutation[] = [];
  const expected = partnerWorkspace();

  for (const record of records) {
    if (!record.exists || !record.data) continue;

    if (record.path.startsWith("contractors/") && record.path.split("/").length === 2) {
      const target = assertAllowlistedContractorId(record.id);
      if (needsWorkspacePatch(record, expected.id)) {
        addMutation(mutations, record, workspacePayload(`Recover ${target.key} contractor workspace relationship`), "Contractor canonical record is missing or conflicting canonical workspace fields.");
      }
      continue;
    }

    if (record.path.startsWith("users/")) {
      const target = assertAllowlistedContractorId(record.id);
      if (needsWorkspacePatch(record, expected.id)) {
        addMutation(mutations, record, workspacePayload(`Recover ${target.key} user workspace relationship`), "Contractor user profile is missing or conflicting canonical workspace fields.");
      }
      continue;
    }

    if (RELATED_COLLECTIONS.some((collection) => record.path.startsWith(`${collection}/`))) {
      const contractorId = asString(record.data.contractorId);
      if (!contractorId || !targetForContractorId(contractorId)) {
        throw new Error(`Related record ${record.path} is not tied to an allowlisted contractor.`);
      }
      if (needsWorkspacePatch(record, expected.id)) {
        addMutation(mutations, record, workspacePayload(`Recover related record workspace for ${contractorId}`), "Related record is tied to an allowlisted contractor and is missing or conflicting workspace fields.");
      }
    }
  }

  return mutations.sort((a, b) => a.path.localeCompare(b.path));
}

export function firestoreSafe(value: unknown): unknown {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(firestoreSafe);
  if (typeof value === "object") {
    const out: AnyRecord = {};
    for (const [key, item] of Object.entries(value as AnyRecord)) out[key] = firestoreSafe(item);
    return out;
  }
  return null;
}

function verify(records: RecoveryDocument[], mutations: RecoveryMutation[]): RecoveryVerification {
  const failures: string[] = [];
  const expected = partnerWorkspace();
  const byPath = new Map(records.map((record) => [record.path, record]));
  const expectedRecords = records.map((record) => {
    const mutation = mutations.find((item) => item.path === record.path);
    return mutation ? { ...record, data: mutation.after } : record;
  });

  for (const target of RECOVERY_TARGETS) {
    const contractor = byPath.get(`contractors/${target.contractorId}`);
    const user = byPath.get(`users/${target.contractorId}`);
    if (!contractor?.exists) failures.push(`Missing contractors/${target.contractorId}`);
    if (!user?.exists) failures.push(`Missing users/${target.contractorId}`);
  }

  const expectedMutationsAfter = buildRecoveryMutations(expectedRecords);
  const unrelated = mutations.some((mutation) => {
    try {
      assertAllowedPath(mutation.path);
      return false;
    } catch {
      return true;
    }
  });

  const duplicateContractorRecordsDetected = records
    .filter((record) => record.path.startsWith("contractors/") && record.path.split("/").length === 2)
    .length !== RECOVERY_TARGETS.length;

  const contractorDocumentsAttached = records
    .filter((record) => record.path.includes("/documents/"))
    .every((record) => {
      const [, contractorId] = record.path.split("/");
      return Boolean(targetForContractorId(contractorId)) && (!record.data?.contractorId || record.data.contractorId === contractorId);
    });

  const plannedMetadataSafe = mutations.every((mutation) => firestoreSafe(mutation.after) !== null);

  const contractorWorkspaceConsistent = expectedRecords
    .filter((record) => record.path.startsWith("contractors/") && record.path.split("/").length === 2)
    .every((record) => getWorkspaceId(record.data) === expected.id);

  const userWorkspaceConsistent = expectedRecords
    .filter((record) => record.path.startsWith("users/"))
    .every((record) => getWorkspaceId(record.data) === expected.id);

  const relatedRecordsConsistent = expectedRecords
    .filter((record) => RELATED_COLLECTIONS.some((collection) => record.path.startsWith(`${collection}/`)))
    .every((record) => !record.data?.contractorId || targetForContractorId(String(record.data.contractorId)) !== null);

  if (expectedMutationsAfter.length) failures.push("Expected-state idempotency check still produced mutations.");
  if (unrelated) failures.push("Mutation plan contains unrelated record paths.");

  return {
    contractorWorkspaceConsistent,
    userWorkspaceConsistent,
    contractorDocumentsAttached,
    relatedRecordsConsistent,
    duplicateContractorRecordsDetected,
    unrelatedRecordsPlanned: unrelated,
    auditMetadataFirestoreSafe: plannedMetadataSafe,
    idempotentAfterExpectedState: expectedMutationsAfter.length === 0,
    failures,
  };
}

export async function buildRecoveryPlan(db: FirestoreLike, mode: RecoveryMode, projectId: string | null): Promise<RecoveryPlan> {
  const records = await collectRecoveryEvidence(db);
  const mutations = buildRecoveryMutations(records);
  return {
    migrationId: MIGRATION_ID,
    generatedAt: nowIso(),
    mode,
    projectId,
    targetWorkspace: partnerWorkspace(),
    targets: RECOVERY_TARGETS,
    evidence: RECOVERY_TARGETS.flatMap((target) => target.evidence),
    mutations,
    verification: verify(records, mutations),
  };
}

export function assertApplyConfirmed(mode: RecoveryMode, env: NodeJS.ProcessEnv = process.env): void {
  if (mode !== "apply") return;
  if (env.TEOS_MIGRATION_CONFIRM !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires TEOS_MIGRATION_CONFIRM=${APPLY_CONFIRMATION}.`);
  }
}

export function buildBackup(records: RecoveryDocument[], plannedMutations: RecoveryMutation[], projectId: string | null): RecoveryBackup {
  const backup: RecoveryBackup = {
    schemaVersion: 1,
    migrationId: MIGRATION_ID,
    action: "backup",
    createdAt: nowIso(),
    projectId,
    targetWorkspaceId: partnerWorkspace().id,
    allowedContractorIds: RECOVERY_TARGETS.map((target) => target.contractorId),
    records: records.map(clone),
    plannedMutations: plannedMutations.map(clone),
    metadata: firestoreSafe({
      source: "contractorWorkspaceRecovery",
      applyConfirmation: APPLY_CONFIRMATION,
    }) as AnyRecord,
  };
  validateBackup(backup, projectId);
  return backup;
}

export function writeBackupFile(backup: RecoveryBackup, outputDir = BACKUP_DIR): string {
  const filename = `${MIGRATION_ID}-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
  const outputPath = join(process.cwd(), outputDir, filename);
  if (existsSync(outputPath)) throw new Error(`Backup already exists: ${outputPath}`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(backup, null, 2), { encoding: "utf8", flag: "wx" });
  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as RecoveryBackup;
  validateBackup(parsed, backup.projectId);
  return outputPath;
}

export function validateBackup(value: unknown, expectedProjectId: string | null): asserts value is RecoveryBackup {
  const backup = value as Partial<RecoveryBackup>;
  if (!backup || typeof backup !== "object") throw new Error("Backup must be a JSON object.");
  if (backup.schemaVersion !== 1 || backup.migrationId !== MIGRATION_ID || backup.action !== "backup") throw new Error("Backup schema or migration identity is invalid.");
  if ((backup.projectId ?? null) !== (expectedProjectId ?? null)) throw new Error("Backup project identity does not match this run.");
  if (backup.targetWorkspaceId !== partnerWorkspace().id) throw new Error("Backup target workspace does not match partner workspace.");
  if (!Array.isArray(backup.records) || !Array.isArray(backup.plannedMutations)) throw new Error("Backup records or mutations are missing.");
  for (const path of [...backup.records.map((record) => record.path), ...backup.plannedMutations.map((mutation) => mutation.path)]) {
    assertAllowedPath(path);
  }
  for (const contractorId of backup.allowedContractorIds ?? []) assertAllowlistedContractorId(contractorId);
}

export function buildRollbackMutations(backup: RecoveryBackup): RecoveryMutation[] {
  validateBackup(backup, backup.projectId ?? null);
  const byPath = new Map(backup.records.map((record) => [record.path, record]));
  return backup.plannedMutations.map((mutation) => {
    const original = byPath.get(mutation.path);
    if (!original) throw new Error(`Backup does not contain original state for ${mutation.path}.`);
    if (!original.exists || !original.data) throw new Error(`Rollback deletion/restoration for missing records is not supported: ${mutation.path}.`);
    return {
      path: mutation.path,
      operation: "set",
      before: mutation.after,
      after: original.data,
      reason: `Rollback ${MIGRATION_ID} from verified backup.`,
    };
  });
}

async function applyMutations(db: FirestoreLike, mutations: RecoveryMutation[]) {
  if (!mutations.length) return;
  if (!db.runTransaction) throw new Error("Firestore transaction support is required for apply mode.");

  await db.runTransaction(async (transaction) => {
    const reads = new Map<string, DocumentSnapshotLike>();
    for (const mutation of mutations) {
      assertAllowedPath(mutation.path);
      const ref = db.doc(mutation.path);
      const snap = await transaction.get(ref);
      reads.set(mutation.path, snap);
      const current = snap.exists ? clone(snap.data() ?? {}) : null;
      if (JSON.stringify(current) !== JSON.stringify(mutation.before)) {
        throw new Error(`Guard failed for ${mutation.path}; document changed after plan generation.`);
      }
    }
    for (const mutation of mutations) {
      const ref = db.doc(mutation.path);
      transaction.set(ref, firestoreSafe(mutation.after) as AnyRecord, { merge: false });
    }
  });
}

export async function runRecovery(input: {
  db: FirestoreLike;
  mode: RecoveryMode;
  projectId: string | null;
  backupOutputDir?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ plan: RecoveryPlan; backupPath: string | null }> {
  assertApplyConfirmed(input.mode, input.env);
  const records = await collectRecoveryEvidence(input.db);
  const mutations = buildRecoveryMutations(records);
  const plan: RecoveryPlan = {
    migrationId: MIGRATION_ID,
    generatedAt: nowIso(),
    mode: input.mode,
    projectId: input.projectId,
    targetWorkspace: partnerWorkspace(),
    targets: RECOVERY_TARGETS,
    evidence: RECOVERY_TARGETS.flatMap((target) => target.evidence),
    mutations,
    verification: verify(records, mutations),
  };

  if (plan.verification.failures.length) throw new Error(`Recovery verification failed: ${plan.verification.failures.join("; ")}`);
  if (input.mode !== "apply") return { plan, backupPath: null };

  const backup = buildBackup(records, mutations, input.projectId);
  const backupPath = writeBackupFile(backup, input.backupOutputDir);
  await applyMutations(input.db, mutations);
  return { plan, backupPath };
}

export async function runRollback(input: {
  db: FirestoreLike;
  backup: RecoveryBackup;
  mode: RecoveryMode;
  projectId: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<{ mutations: RecoveryMutation[] }> {
  assertApplyConfirmed(input.mode, input.env);
  validateBackup(input.backup, input.projectId);
  const mutations = buildRollbackMutations(input.backup);
  if (input.mode === "apply") await applyMutations(input.db, mutations);
  return { mutations };
}


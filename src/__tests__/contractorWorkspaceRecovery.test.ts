import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  APPLY_CONFIRMATION,
  MIGRATION_ID,
  assertAllowlistedContractorId,
  buildBackup,
  buildRecoveryMutations,
  buildRecoveryPlan,
  buildRollbackMutations,
  collectRecoveryEvidence,
  firestoreSafe,
  runRecovery,
  runRollback,
  validateBackup,
  type DocumentReferenceLike,
  type DocumentSnapshotLike,
  type FirestoreLike,
  type TransactionLike,
} from "@/lib/maintenance/contractorWorkspaceRecovery";

const PARTNER_ID = "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9006";
const confirmedEnv = { TEOS_MIGRATION_CONFIRM: APPLY_CONFIRMATION } as unknown as NodeJS.ProcessEnv;
type Store = Record<string, Record<string, unknown>>;

class MemoryDb implements FirestoreLike {
  writes: string[] = [];
  constructor(public store: Store) {}
  doc(path: string): DocumentReferenceLike {
    return { id: path.split("/").pop(), path, get: async () => this.snapshot(path) };
  }
  collection(path: string) {
    return {
      doc: (id = "generated") => this.doc(`${path}/${id}`),
      get: async () => ({ docs: this.paths(path).map((docPath) => this.snapshot(docPath)) }),
      where: (field: string, _op: "==", value: unknown) => ({
        limit: () => ({
          get: async () => ({ docs: this.paths(path).filter((docPath) => this.store[docPath][field] === value).map((docPath) => this.snapshot(docPath)) }),
        }),
      }),
    };
  }
  async runTransaction<T>(fn: (transaction: TransactionLike) => Promise<T>): Promise<T> {
    const transaction = {
      get: async (ref: DocumentReferenceLike) => this.snapshot(ref.path ?? ""),
      set: (ref: DocumentReferenceLike, data: Record<string, unknown>) => {
        this.store[ref.path ?? ""] = JSON.parse(JSON.stringify(data));
        this.writes.push(ref.path ?? "");
        return transaction as TransactionLike;
      },
    };
    return fn(transaction as TransactionLike);
  }
  private paths(collectionPath: string) {
    return Object.keys(this.store).filter((docPath) => docPath.startsWith(`${collectionPath}/`) && docPath.split("/").length === collectionPath.split("/").length + 1);
  }
  private snapshot(path: string): DocumentSnapshotLike {
    const data = this.store[path];
    return { id: path.split("/").pop() ?? path, exists: Boolean(data), ref: { id: path.split("/").pop(), path }, data: () => data };
  }
}

function baseStore(): Store {
  return {
    "contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2": { contractorId: "VITBVkrgSdVMRshLn5WEVnmgqFO2", companyName: "Mackay and Daughters Enterprises", authUid: "VITBVkrgSdVMRshLn5WEVnmgqFO2", userId: "VITBVkrgSdVMRshLn5WEVnmgqFO2" },
    "users/VITBVkrgSdVMRshLn5WEVnmgqFO2": { uid: "VITBVkrgSdVMRshLn5WEVnmgqFO2", role: "contractor", contractorId: "VITBVkrgSdVMRshLn5WEVnmgqFO2" },
    "contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2/documents/taxClearance": { contractorId: "VITBVkrgSdVMRshLn5WEVnmgqFO2", documentType: "taxClearance" },
    "contractors/s2crtIJSqFNe9ipkbgDNJoOvkLY2": { contractorId: "s2crtIJSqFNe9ipkbgDNJoOvkLY2", companyName: "F E MILLER POOLS", authUid: "s2crtIJSqFNe9ipkbgDNJoOvkLY2", userId: "s2crtIJSqFNe9ipkbgDNJoOvkLY2" },
    "users/s2crtIJSqFNe9ipkbgDNJoOvkLY2": { uid: "s2crtIJSqFNe9ipkbgDNJoOvkLY2", role: "contractor", contractorId: "s2crtIJSqFNe9ipkbgDNJoOvkLY2" },
    "deals/deal-1": { contractorId: "VITBVkrgSdVMRshLn5WEVnmgqFO2", title: "Mackay related deal" },
    "submissionReviews/review-1": { contractorId: "s2crtIJSqFNe9ipkbgDNJoOvkLY2", dealId: "review-1" },
    "contractors/not-allowed": { contractorId: "not-allowed", companyName: "Other Contractor" },
  };
}

function testOutputDir(name: string) {
  return `output/maintenance/contractor-workspace-recovery-${name}-${Math.random().toString(36).slice(2)}`;
}

describe("contractor workspace recovery", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-07-21T10:02:00.000Z")));
  afterEach(() => jest.useRealTimers());

  it("accepts allowlisted contractor and rejects non-allowlisted contractor", () => {
    expect(assertAllowlistedContractorId("VITBVkrgSdVMRshLn5WEVnmgqFO2").key).toBe("mackay");
    expect(() => assertAllowlistedContractorId("not-allowed")).toThrow(/not allowlisted/);
  });

  it("rejects ambiguous contractor identity", async () => {
    const store = baseStore();
    store["contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2"].companyName = "Mackay Clone";
    await expect(collectRecoveryEvidence(new MemoryDb(store))).rejects.toThrow(/Ambiguous contractor identity/);
  });

  it("dry-run performs no writes and builds a deterministic recovery plan", async () => {
    const store = baseStore();
    const db = new MemoryDb(store);
    const plan = await buildRecoveryPlan(db, "dry-run", "test-project");
    expect(db.writes).toEqual([]);
    expect(plan.mutations.map((mutation) => mutation.path)).toEqual([
      "contractors/s2crtIJSqFNe9ipkbgDNJoOvkLY2",
      "contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2",
      "deals/deal-1",
      "submissionReviews/review-1",
      "users/s2crtIJSqFNe9ipkbgDNJoOvkLY2",
      "users/VITBVkrgSdVMRshLn5WEVnmgqFO2",
    ]);
    expect(store["contractors/not-allowed"].workspaceId).toBeUndefined();
  });

  it("apply mode requires both confirmations", async () => {
    await expect(runRecovery({ db: new MemoryDb(baseStore()), mode: "apply", projectId: "test-project", env: {} as NodeJS.ProcessEnv })).rejects.toThrow(`TEOS_MIGRATION_CONFIRM=${APPLY_CONFIRMATION}`);
  });

  it("backup failure prevents writes", async () => {
    const outputDir = testOutputDir("backup-failure");
    const backupPath = join(process.cwd(), outputDir, `${MIGRATION_ID}-2026-07-21T10-02-00-000Z.json`);
    mkdirSync(join(process.cwd(), outputDir), { recursive: true });
    writeFileSync(backupPath, "existing", "utf8");
    const db = new MemoryDb(baseStore());
    await expect(runRecovery({ db, mode: "apply", projectId: "test-project", backupOutputDir: outputDir, env: confirmedEnv })).rejects.toThrow(/Backup already exists/);
    expect(db.writes).toEqual([]);
  });

  it("is idempotent on a second run and leaves unrelated records unchanged", async () => {
    const db = new MemoryDb(baseStore());
    await runRecovery({ db, mode: "apply", projectId: "test-project", backupOutputDir: testOutputDir("idempotent"), env: confirmedEnv });
    const second = await buildRecoveryPlan(db, "dry-run", "test-project");
    expect(second.mutations).toEqual([]);
    expect(second.verification.idempotentAfterExpectedState).toBe(true);
    expect(db.store["contractors/not-allowed"].workspaceId).toBeUndefined();
  });

  it("rollback rejects unrelated paths", () => {
    expect(() => validateBackup({
      schemaVersion: 1,
      migrationId: MIGRATION_ID,
      action: "backup",
      createdAt: "2026-07-21T10:02:00.000Z",
      projectId: "test-project",
      targetWorkspaceId: PARTNER_ID,
      allowedContractorIds: ["VITBVkrgSdVMRshLn5WEVnmgqFO2"],
      records: [{ path: "users/not-allowed", id: "not-allowed", exists: true, data: {} }],
      plannedMutations: [],
      metadata: {},
    }, "test-project")).toThrow(/outside/);
  });

  it("rollback restores the recorded before state", async () => {
    const db = new MemoryDb(baseStore());
    const records = await collectRecoveryEvidence(db);
    const backup = buildBackup(records, buildRecoveryMutations(records), "test-project");
    await runRecovery({ db, mode: "apply", projectId: "test-project", backupOutputDir: testOutputDir("rollback"), env: confirmedEnv });
    expect(db.store["contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2"].workspaceId).toBe(PARTNER_ID);
    await runRollback({ db, backup, mode: "apply", projectId: "test-project", env: confirmedEnv });
    expect(db.store["contractors/VITBVkrgSdVMRshLn5WEVnmgqFO2"].workspaceId).toBeUndefined();
  });

  it("builds rollback mutations from recorded before state and uses Firestore-safe audit metadata", async () => {
    const db = new MemoryDb(baseStore());
    const records = await collectRecoveryEvidence(db);
    const rollback = buildRollbackMutations(buildBackup(records, buildRecoveryMutations(records), "test-project"));
    expect(rollback[0].reason).toContain("Rollback");
    expect(rollback.every((mutation) => mutation.after.workspaceId === undefined)).toBe(true);
    expect(firestoreSafe({ a: undefined, b: () => true, c: new Date("2026-07-21T10:02:00.000Z") })).toEqual({ a: null, b: null, c: "2026-07-21T10:02:00.000Z" });
  });
});


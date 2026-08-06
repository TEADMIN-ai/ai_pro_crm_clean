export const WORKSPACE_REPAIR_LOGIC_VERSION = "contractor-workspace-repair-v1";

const BENCHMARK_IDS = new Set(["torque-empire-benchmark"]);
const ALLOWED_FIELDS = ["workspaceId", "workspaceResolutionStatus", "workspaceRepairMetadata"] as const;

export type WorkspaceEvidence = {
  workspaceId: string;
  source: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reference?: string | null;
};

export type WorkspaceRepairRecord = {
  id: string;
  workspaceId?: string | null;
  archived?: boolean;
  status?: string | null;
  isBenchmark?: boolean;
  companyName?: string | null;
  businessName?: string | null;
  name?: string | null;
  readinessScore?: unknown;
  complianceScore?: unknown;
  complianceApproved?: unknown;
  workspaceResolutionStatus?: unknown;
  workspaceRepairMetadata?: unknown;
};

export type WorkspaceRepairTarget = {
  contractorId: string;
  targetWorkspaceId: string;
  workspaceEvidence: WorkspaceEvidence[];
  duplicateCanonicalIdentityIds?: string[];
};

export type WorkspaceRepairPlan = {
  mode: "DRY_RUN";
  status: "READY" | "NOOP" | "BLOCKED";
  contractorId: string;
  targetWorkspaceId: string | null;
  blockers: string[];
  warnings: string[];
  allowedFields: readonly string[];
  before: Record<string, unknown>;
  proposedChanges: Record<string, unknown>;
  rollback: {
    contractorId: string;
    restoreFields: Record<string, unknown>;
  };
  recomputationRequired: true;
  readinessElevated: false;
  complianceElevated: false;
  repairMetadata: {
    logicVersion: string;
    repairType: "WORKSPACE_VISIBILITY";
    mode: "DRY_RUN";
    contractorId: string;
    targetWorkspaceId: string | null;
    evidence: WorkspaceEvidence[];
  };
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayName(record: WorkspaceRepairRecord): string {
  return clean(record.companyName) ?? clean(record.businessName) ?? clean(record.name) ?? record.id;
}

function basePlan(contractorId: string, targetWorkspaceId: string | null, evidence: WorkspaceEvidence[]): WorkspaceRepairPlan {
  return {
    mode: "DRY_RUN",
    status: "BLOCKED",
    contractorId,
    targetWorkspaceId,
    blockers: [],
    warnings: [],
    allowedFields: ALLOWED_FIELDS,
    before: {},
    proposedChanges: {},
    rollback: { contractorId, restoreFields: {} },
    recomputationRequired: true,
    readinessElevated: false,
    complianceElevated: false,
    repairMetadata: {
      logicVersion: WORKSPACE_REPAIR_LOGIC_VERSION,
      repairType: "WORKSPACE_VISIBILITY",
      mode: "DRY_RUN",
      contractorId,
      targetWorkspaceId,
      evidence,
    },
  };
}

export function buildWorkspaceRepairPlan(
  record: WorkspaceRepairRecord | null | undefined,
  target: WorkspaceRepairTarget,
): WorkspaceRepairPlan {
  const evidence = target.workspaceEvidence ?? [];
  const plan = basePlan(target.contractorId, clean(target.targetWorkspaceId), evidence);
  if (!record) {
    plan.blockers.push("Contractor record is missing");
    return plan;
  }
  if (record.id !== target.contractorId) {
    plan.blockers.push("Contractor target does not match the supplied record");
  }
  if (record.archived === true) plan.blockers.push("Archived contractor requires explicit separate review");
  if (record.isBenchmark === true || BENCHMARK_IDS.has(record.id)) plan.blockers.push("Benchmark contractor cannot be repaired");
  if (!clean(target.targetWorkspaceId)) plan.blockers.push("Explicit target workspace is required");
  if (target.duplicateCanonicalIdentityIds && target.duplicateCanonicalIdentityIds.length > 0) {
    plan.blockers.push("Duplicate canonical identity requires manual review");
  }

  const evidenceIds = Array.from(new Set(evidence.map((item) => clean(item.workspaceId)).filter((value): value is string => Boolean(value))));
  if (evidenceIds.length === 0) plan.blockers.push("Workspace evidence is missing");
  if (evidenceIds.length > 1) plan.blockers.push("Workspace evidence is ambiguous");
  if (evidenceIds.length === 1 && evidenceIds[0] !== clean(target.targetWorkspaceId)) plan.blockers.push("Target workspace conflicts with workspace evidence");
  if (evidence.some((item) => item.confidence === "LOW")) plan.warnings.push("Workspace evidence includes a low-confidence source");

  const before = {
    workspaceId: record.workspaceId ?? null,
    workspaceResolutionStatus: record.workspaceResolutionStatus ?? null,
    workspaceRepairMetadata: record.workspaceRepairMetadata ?? null,
  };
  plan.before = before;
  plan.rollback.restoreFields = before;

  if (plan.blockers.length > 0) return plan;
  const targetWorkspaceId = clean(target.targetWorkspaceId)!;
  if (clean(record.workspaceId) === targetWorkspaceId) {
    plan.status = "NOOP";
    plan.warnings.push("Contractor already has the requested workspace");
    return plan;
  }

  plan.status = "READY";
  plan.proposedChanges = {
    workspaceId: targetWorkspaceId,
    workspaceResolutionStatus: "RESOLVED",
    workspaceRepairMetadata: {
      logicVersion: WORKSPACE_REPAIR_LOGIC_VERSION,
      repairType: "WORKSPACE_VISIBILITY",
      mode: "DRY_RUN",
      contractorId: record.id,
      contractorName: displayName(record),
      targetWorkspaceId,
      evidence,
      readinessRecomputationRequired: true,
      complianceRecomputationRequired: true,
    },
  };
  return plan;
}

export function buildWorkspaceRepairPlans(
  records: WorkspaceRepairRecord[],
  targets: WorkspaceRepairTarget[],
): WorkspaceRepairPlan[] {
  if (targets.length === 0) throw new Error("At least one explicit contractor target is required");
  const ids = new Set<string>();
  return targets.map((target) => {
    if (ids.has(target.contractorId)) throw new Error(`Duplicate contractor target: ${target.contractorId}`);
    ids.add(target.contractorId);
    return buildWorkspaceRepairPlan(records.find((record) => record.id === target.contractorId), target);
  });
}


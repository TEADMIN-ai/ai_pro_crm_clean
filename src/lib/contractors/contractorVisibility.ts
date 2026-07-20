export type ContractorRecordClassification =
  | "PRODUCTION"
  | "QA"
  | "TEST"
  | "DEMO"
  | "BENCHMARK"
  | "ARCHIVED"
  | "LEGACY_UNASSIGNED";

export type ContractorVisibilityRole = "admin" | "manager" | "staff" | "contractor" | string;

export interface ContractorVisibilityContext {
  workspaceId?: string | null;
  actorRole?: ContractorVisibilityRole | null;
  includeArchived?: boolean;
  includeNonProduction?: boolean;
  includeLegacyUnassigned?: boolean;
}

export interface ContractorVisibilityDecision {
  visible: boolean;
  classification: ContractorRecordClassification;
  reason: string | null;
}

export interface ContractorVisibilityDiagnostics {
  totalRecords: number;
  returnedRecords: number;
  excludedCrossWorkspace: number;
  excludedNonProduction: number;
  excludedArchived: number;
  excludedLegacyUnassigned: number;
  missingWorkspaceContext: number;
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function flag(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true);
}

function normalizedClassification(value: unknown): ContractorRecordClassification | null {
  const raw = clean(value)?.toUpperCase().replace(/[^A-Z]+/g, "_") ?? null;
  if (!raw) return null;
  if (raw === "PRODUCTION") return "PRODUCTION";
  if (raw === "QA") return "QA";
  if (raw === "TEST") return "TEST";
  if (raw === "DEMO") return "DEMO";
  if (raw === "BENCHMARK") return "BENCHMARK";
  if (raw === "ARCHIVED") return "ARCHIVED";
  if (raw === "LEGACY_UNASSIGNED") return "LEGACY_UNASSIGNED";
  return null;
}

export function getContractorRecordWorkspaceId(record: Record<string, unknown>): string | null {
  const workspace = record.workspace && typeof record.workspace === "object"
    ? (record.workspace as Record<string, unknown>)
    : null;
  return clean(record.workspaceId) ?? clean(workspace?.id) ?? null;
}

export function classifyContractorRecord(record: Record<string, unknown>): ContractorRecordClassification {
  const explicit = normalizedClassification(record.recordClassification ?? record.classification ?? record.contractorClassification);
  if (explicit && explicit !== "PRODUCTION") return explicit;

  const status = clean(record.status)?.toLowerCase() ?? null;
  if (record.archived === true || clean(record.archivedAt) || status === "archived") return "ARCHIVED";
  if (record.qa === true || record.safeToDelete === true || clean(record.qaNamespace)) return "QA";
  if (flag(record, "demo", "demoContractor", "demoData")) return "DEMO";
  if (flag(record, "benchmark", "benchmarkContractor")) return "BENCHMARK";
  if (flag(record, "canonical", "canonicalProfile", "operationalReplayContractor", "regressionValidationContractor")) return "BENCHMARK";
  if (explicit === "PRODUCTION") return "PRODUCTION";
  if (!getContractorRecordWorkspaceId(record)) return "LEGACY_UNASSIGNED";
  return "PRODUCTION";
}

export function isPrivilegedContractorVisibilityRole(role: ContractorVisibilityRole | null | undefined): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function isContractorVisibleToWorkspace(
  record: Record<string, unknown>,
  context: ContractorVisibilityContext,
): ContractorVisibilityDecision {
  const classification = classifyContractorRecord(record);
  const workspaceId = clean(context.workspaceId);
  const recordWorkspaceId = getContractorRecordWorkspaceId(record);

  if (classification === "ARCHIVED" && !(context.includeArchived === true && context.actorRole === "admin")) {
    return { visible: false, classification, reason: "archived" };
  }

  if (
    classification !== "PRODUCTION" &&
    classification !== "LEGACY_UNASSIGNED" &&
    classification !== "ARCHIVED" &&
    !(context.includeNonProduction === true && context.actorRole === "admin")
  ) {
    return { visible: false, classification, reason: "non_production" };
  }

  if (classification === "LEGACY_UNASSIGNED") {
    if (context.includeLegacyUnassigned === true && context.actorRole === "admin") {
      return { visible: true, classification, reason: null };
    }
    return { visible: false, classification, reason: "legacy_unassigned" };
  }

  if (!workspaceId) {
    return { visible: false, classification, reason: "missing_workspace_context" };
  }

  if (!recordWorkspaceId) {
    return context.includeLegacyUnassigned === true && context.actorRole === "admin"
      ? { visible: true, classification: "LEGACY_UNASSIGNED", reason: null }
      : { visible: false, classification: "LEGACY_UNASSIGNED", reason: "legacy_unassigned" };
  }

  if (recordWorkspaceId !== workspaceId) {
    return { visible: false, classification, reason: "cross_workspace" };
  }

  return { visible: true, classification, reason: null };
}

export function emptyContractorVisibilityDiagnostics(): ContractorVisibilityDiagnostics {
  return {
    totalRecords: 0,
    returnedRecords: 0,
    excludedCrossWorkspace: 0,
    excludedNonProduction: 0,
    excludedArchived: 0,
    excludedLegacyUnassigned: 0,
    missingWorkspaceContext: 0,
  };
}

export function updateContractorVisibilityDiagnostics(
  diagnostics: ContractorVisibilityDiagnostics,
  decision: ContractorVisibilityDecision,
): void {
  diagnostics.totalRecords += 1;
  if (decision.visible) {
    diagnostics.returnedRecords += 1;
    return;
  }
  if (decision.reason === "cross_workspace") diagnostics.excludedCrossWorkspace += 1;
  else if (decision.reason === "archived") diagnostics.excludedArchived += 1;
  else if (decision.reason === "legacy_unassigned") diagnostics.excludedLegacyUnassigned += 1;
  else if (decision.reason === "missing_workspace_context") diagnostics.missingWorkspaceContext += 1;
  else diagnostics.excludedNonProduction += 1;
}

export type RepairSeverity = "Critical" | "High" | "Medium" | "Low";

export type RepairStrategy =
  | "RESTORE TARGET"
  | "RELINK"
  | "REMOVE REFERENCE"
  | "ARCHIVE"
  | "SAFE DELETE"
  | "KEEP"
  | "MANUAL REVIEW";

export type RepairMode = "dry-run" | "apply";

export type BrokenReferenceIssue = {
  issueId: string;
  collection: string;
  documentId: string;
  sourcePath: string;
  referenceField: string;
  expectedTarget: string;
  missingTarget: string;
  relationshipType: string;
  rootCause: string;
  severity: RepairSeverity;
  repairStrategy: string;
  repairExplanation: string;
  sourceRecommendation?: string;
  sourceLabel?: string;
  sourceReasons?: string[];
};

export type RepairOperationType = "restore-target" | "relink-source" | "preserve" | "manual-review" | "skip";

export type RepairOperation = {
  issueId: string;
  type: RepairOperationType;
  severity: RepairSeverity;
  sourcePath: string;
  referenceField: string;
  targetPath: string;
  updatePath?: string;
  updateData?: Record<string, unknown>;
  reason: string;
  safe: boolean;
};

export type RepairResultStatus = "planned" | "applied" | "verified" | "skipped" | "manual-review" | "failed";

export type RepairResult = {
  issueId: string;
  severity: RepairSeverity;
  sourcePath: string;
  referenceField: string;
  targetPath: string;
  operationType: RepairOperationType;
  status: RepairResultStatus;
  reason: string;
  beforeExists: boolean;
  afterExists: boolean;
  error?: string;
};

export function shouldAttemptRepair(issue: BrokenReferenceIssue): boolean {
  if (issue.severity === "Critical" || issue.severity === "High") return true;
  if (issue.severity === "Medium") return issue.repairStrategy !== "MANUAL REVIEW";
  return issue.missingTarget === "users/system";
}

export function isArchivalCandidate(issue: BrokenReferenceIssue): boolean {
  const text = [
    issue.sourceLabel,
    issue.sourceRecommendation,
    ...(issue.sourceReasons ?? []),
  ].join(" ");

  return /\b(qa|test|dummy|mock|sample|fixture)\b/i.test(text) || /example\.com/i.test(text);
}

export function nowIso() {
  return new Date().toISOString();
}

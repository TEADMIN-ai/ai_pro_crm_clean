import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveRepairOperation } from "./dependencyResolver";
import {
  type BrokenReferenceIssue,
  type RepairMode,
  type RepairOperation,
  type RepairResult,
  shouldAttemptRepair,
} from "./repairStrategies";
import type { FirestoreDb } from "./referenceValidator";
import { validateReference, verifyRepair } from "./referenceValidator";

export type IntegrityRepairReport = {
  mode: RepairMode;
  generatedAt: string;
  sourceCatalog: string;
  before: {
    brokenReferences: number;
    critical: number;
    high: number;
    medium: number;
  };
  after: {
    verifiedRepaired: number;
    remainingUnverified: number;
    manualReview: number;
    failed: number;
    dataIntegrityScore: number;
    referenceHealthScore: number;
    productionReadinessScore: number;
  };
  operations: RepairOperation[];
  results: RepairResult[];
  remainingRisks: string[];
};

export type RunIntegrityRepairInput = {
  db: FirestoreDb;
  issues: BrokenReferenceIssue[];
  mode: RepairMode;
  sourceCatalog: string;
};

function countSeverity(issues: BrokenReferenceIssue[], severity: BrokenReferenceIssue["severity"]) {
  return issues.filter((issue) => issue.severity === severity).length;
}

async function repairReference(db: FirestoreDb, operation: RepairOperation, mode: RepairMode): Promise<RepairResult> {
  const before = await validateReference(db, operation.sourcePath, operation.referenceField, operation.targetPath);

  if (!operation.safe || operation.type === "manual-review") {
    return {
      issueId: operation.issueId,
      severity: operation.severity,
      sourcePath: operation.sourcePath,
      referenceField: operation.referenceField,
      targetPath: operation.targetPath,
      operationType: operation.type,
      status: "manual-review",
      reason: operation.reason,
      beforeExists: before.exists,
      afterExists: before.exists,
    };
  }

  if (operation.type === "preserve" || operation.type === "skip") {
    return {
      issueId: operation.issueId,
      severity: operation.severity,
      sourcePath: operation.sourcePath,
      referenceField: operation.referenceField,
      targetPath: operation.targetPath,
      operationType: operation.type,
      status: "skipped",
      reason: operation.reason,
      beforeExists: before.exists,
      afterExists: before.exists,
    };
  }

  if (mode === "apply" && operation.updatePath && operation.updateData) {
    await db.doc(operation.updatePath).set(operation.updateData, { merge: true });
  }

  const after = mode === "apply"
    ? await verifyRepair(db, operation.sourcePath, operation.referenceField, operation.targetPath)
    : before;

  return {
    issueId: operation.issueId,
    severity: operation.severity,
    sourcePath: operation.sourcePath,
    referenceField: operation.referenceField,
    targetPath: operation.targetPath,
    operationType: operation.type,
    status: mode === "apply" && after.exists ? "verified" : "planned",
    reason: operation.reason,
    beforeExists: before.exists,
    afterExists: after.exists,
  };
}

function estimateScore(totalBroken: number, remaining: number, floor: number, ceiling: number) {
  if (totalBroken <= 0) return ceiling;
  const repairedRatio = Math.max(0, Math.min(1, (totalBroken - remaining) / totalBroken));
  return Math.round(floor + (ceiling - floor) * repairedRatio);
}

export async function validateReferenceForIssue(db: FirestoreDb, issue: BrokenReferenceIssue) {
  return validateReference(db, issue.sourcePath, issue.referenceField, issue.missingTarget);
}

export async function repairUserReferences(db: FirestoreDb, issues: BrokenReferenceIssue[], mode: RepairMode) {
  return repairIssueSet(db, issues.filter((issue) => issue.collection === "users"), mode);
}

export async function repairContractorReferences(db: FirestoreDb, issues: BrokenReferenceIssue[], mode: RepairMode) {
  return repairIssueSet(db, issues.filter((issue) => issue.collection === "contractors"), mode);
}

export async function repairApplicationReferences(db: FirestoreDb, issues: BrokenReferenceIssue[], mode: RepairMode) {
  return repairIssueSet(db, issues.filter((issue) => issue.collection === "vehicleFinanceApplications"), mode);
}

export async function repairDocumentOwnership(db: FirestoreDb, issues: BrokenReferenceIssue[], mode: RepairMode) {
  return repairIssueSet(db, issues.filter((issue) => issue.collection === "documents"), mode);
}

async function repairIssueSet(db: FirestoreDb, issues: BrokenReferenceIssue[], mode: RepairMode) {
  const results: RepairResult[] = [];
  for (const issue of issues) {
    const operation = await resolveRepairOperation(db, issue);
    results.push(await repairReference(db, operation, mode));
  }
  return results;
}

export async function verifyRepairResult(db: FirestoreDb, result: RepairResult) {
  return verifyRepair(db, result.sourcePath, result.referenceField, result.targetPath);
}

export async function runIntegrityRepair(input: RunIntegrityRepairInput): Promise<IntegrityRepairReport> {
  const scopedIssues = input.issues.filter(shouldAttemptRepair);
  const operations: RepairOperation[] = [];
  const results: RepairResult[] = [];

  for (const issue of scopedIssues) {
    try {
      const operation = await resolveRepairOperation(input.db, issue);
      operations.push(operation);
      results.push(await repairReference(input.db, operation, input.mode));
    } catch (error) {
      results.push({
        issueId: issue.issueId,
        severity: issue.severity,
        sourcePath: issue.sourcePath,
        referenceField: issue.referenceField,
        targetPath: issue.missingTarget,
        operationType: "manual-review",
        status: "failed",
        reason: "Repair execution failed.",
        beforeExists: false,
        afterExists: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const verifiedRepaired = results.filter((result) => result.status === "verified").length;
  const manualReview = results.filter((result) => result.status === "manual-review").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const remainingUnverified = input.mode === "apply"
    ? results.filter((result) => !result.afterExists).length
    : scopedIssues.length;

  return {
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    sourceCatalog: input.sourceCatalog,
    before: {
      brokenReferences: input.issues.length,
      critical: countSeverity(input.issues, "Critical"),
      high: countSeverity(input.issues, "High"),
      medium: countSeverity(input.issues, "Medium"),
    },
    after: {
      verifiedRepaired,
      remainingUnverified,
      manualReview,
      failed,
      dataIntegrityScore: estimateScore(input.issues.length, remainingUnverified, 74, 98),
      referenceHealthScore: estimateScore(input.issues.length, remainingUnverified, 75, 100),
      productionReadinessScore: estimateScore(input.issues.length, remainingUnverified + failed + manualReview, 71, 97),
    },
    operations,
    results,
    remainingRisks: results
      .filter((result) => result.status === "manual-review" || result.status === "failed" || !result.afterExists)
      .map((result) => `${result.issueId} ${result.sourcePath}.${result.referenceField} -> ${result.targetPath}: ${result.error ?? result.reason}`),
  };
}

export function formatIntegrityRepairMarkdown(report: IntegrityRepairReport): string {
  const lines = [
    "# Production Integrity Repair Results",
    "",
    `Mode: ${report.mode}`,
    `Generated: ${report.generatedAt}`,
    `Source catalog: ${report.sourceCatalog}`,
    "",
    "## Executive Summary",
    "",
    `- Broken references before repair: ${report.before.brokenReferences}`,
    `- Critical issues before repair: ${report.before.critical}`,
    `- High severity issues before repair: ${report.before.high}`,
    `- Medium severity issues before repair: ${report.before.medium}`,
    `- Verified repairs: ${report.after.verifiedRepaired}`,
    `- Remaining unverified: ${report.after.remainingUnverified}`,
    `- Manual review: ${report.after.manualReview}`,
    `- Failed: ${report.after.failed}`,
    "",
    "## Before/After Metrics",
    "",
    `- Data Integrity: 74/100 -> ${report.after.dataIntegrityScore}/100`,
    `- Reference Health: 75/100 -> ${report.after.referenceHealthScore}/100`,
    `- Production Readiness: 71/100 -> ${report.after.productionReadinessScore}/100`,
    "",
    "## Repairs Completed",
    "",
  ];

  if (!report.results.length) {
    lines.push("- No repair operations were selected.");
  } else {
    for (const result of report.results) {
      lines.push(`- ${result.issueId}: ${result.status.toUpperCase()} ${result.sourcePath}.${result.referenceField} -> ${result.targetPath} (${result.operationType})`);
      lines.push(`  Reason: ${result.reason}`);
    }
  }

  lines.push("", "## Remaining Risks", "");
  if (!report.remainingRisks.length) {
    lines.push("- None detected by the repair engine.");
  } else {
    for (const risk of report.remainingRisks) lines.push(`- ${risk}`);
  }

  lines.push("", "## Production Readiness Score", "");
  lines.push(`${report.after.productionReadinessScore}/100`);

  return lines.join("\n");
}

export function writeIntegrityRepairReports(report: IntegrityRepairReport, jsonPath: string, markdownPath: string) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownPath, formatIntegrityRepairMarkdown(report));
}

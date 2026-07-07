import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type FirestoreDb = FirebaseFirestore.Firestore;
type DocumentSnapshot = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;

type CleanupMode = "dry-run" | "apply";
type Recommendation = "delete" | "keep" | "manual-review";

type CollectionScanConfig = {
  name: string;
  limit?: number;
  referenceFields?: string[];
  storageFields?: string[];
};

type RecordFinding = {
  collection: string;
  path: string;
  id: string;
  label: string;
  recommendation: Recommendation;
  reasons: string[];
  riskLevel: "low" | "medium" | "high";
  references: Record<string, string>;
  storagePaths: string[];
};

type IntegrityRisk = {
  level: "low" | "medium" | "high";
  path: string;
  message: string;
};

type CleanupReport = {
  mode: CleanupMode;
  generatedAt: string;
  collectionsScanned: Array<{ collection: string; recordsScanned: number }>;
  recordsFound: number;
  recommendedForDeletion: RecordFinding[];
  recommendedToKeep: RecordFinding[];
  manualReview: RecordFinding[];
  potentialIntegrityRisks: IntegrityRisk[];
  duplicateGroups: Array<{ collection: string; key: string; records: string[] }>;
  storageReferences: Array<{ path: string; source: string }>;
  integrityVerification: {
    brokenReferences: IntegrityRisk[];
    deletionDependencyRisks: IntegrityRisk[];
    storageLeaks: IntegrityRisk[];
    runtimeIntegrityIssues: IntegrityRisk[];
  };
  apply: {
    requested: boolean;
    approvalFile: string | null;
    approvedRecords: string[];
    deletedRecords: string[];
    skippedRecords: string[];
  };
};

type ApprovalFile = {
  approvedRecords: string[];
};

const DEFAULT_REPORT_PATH = "output/maintenance/production-data-cleanup-report.json";
const DEFAULT_MARKDOWN_REPORT_PATH = "output/maintenance/production-data-cleanup-report.md";

const COLLECTIONS: CollectionScanConfig[] = [
  { name: "users", referenceFields: ["contractorId", "workspaceId"], storageFields: [] },
  { name: "contractors", referenceFields: ["authUid", "userId", "workspaceId"], storageFields: ["fileUrl", "storagePath", "documentUrl"] },
  { name: "documents", referenceFields: ["contractorId", "dealId", "uploadedBy"], storageFields: ["fileUrl", "filePath", "storagePath", "url"] },
  { name: "deals", referenceFields: ["contractorId", "userId", "ownerId"], storageFields: ["fileUrl", "storagePath"] },
  { name: "dealNotes", referenceFields: ["dealId", "userId"], storageFields: [] },
  { name: "tenderPacks", referenceFields: ["dealId", "contractorId", "userId"], storageFields: ["fileUrl", "pdfUrl", "storagePath"] },
  { name: "tenderPackRequests", referenceFields: ["dealId", "contractorId", "requestedBy"], storageFields: ["fileUrl", "pdfUrl", "storagePath"] },
  { name: "vehicleFinanceCustomers", referenceFields: ["userId"], storageFields: [] },
  { name: "vehicleFinanceApplications", referenceFields: ["customerId", "vehicleId", "assignedConsultantUid"], storageFields: [] },
  { name: "vehicleFinanceDocuments", referenceFields: ["applicationId", "customerId", "uploadedBy"], storageFields: ["filePath", "fileUrl", "storagePath", "signedUrl"] },
  { name: "vehicleFinanceAssessments", referenceFields: ["applicationId", "customerId"], storageFields: [] },
  { name: "vehicleFinanceCertificates", referenceFields: ["applicationId", "customerId"], storageFields: ["fileUrl", "pdfUrl", "storagePath"] },
  { name: "vehicleFinanceWorkflowTasks", referenceFields: ["applicationId", "assignedUser"], storageFields: [] },
  { name: "vehicleFinanceWorkflowTimeline", referenceFields: ["applicationId", "actorId"], storageFields: [] },
  { name: "vehicleFinanceNotifications", referenceFields: ["applicationId", "actorId"], storageFields: [] },
  { name: "vehicleFinanceApplicationEvents", referenceFields: ["applicationId", "userId", "targetId"], storageFields: [] },
  { name: "vehicleFinanceNotificationQueue", referenceFields: ["applicationId", "customerId"], storageFields: [] },
  { name: "auditLogs", referenceFields: ["userId", "actorId", "contractorId", "applicationId", "targetId"], storageFields: [] },
  { name: "decisionLogs", referenceFields: ["contractorId", "applicationId", "userId"], storageFields: [] },
  { name: "contractorActivity", referenceFields: ["contractorId", "userId"], storageFields: [] },
  { name: "contractorComplianceAudit", referenceFields: ["contractorId", "userId"], storageFields: [] },
  { name: "automationAlerts", referenceFields: ["contractorId", "dealId", "documentId"], storageFields: [] },
  { name: "inventory", referenceFields: ["vehicleId"], storageFields: ["imageUrl", "imageUrls"] },
];

const TEST_PATTERNS = [
  /\bqa\b/i,
  /\btest\b/i,
  /\bdummy\b/i,
  /\bmock\b/i,
  /\bsample\b/i,
  /\bfake\b/i,
  /\bseed\b/i,
  /\bfixture\b/i,
  /@qa\./i,
  /@test\./i,
  /qa-v\d+/i,
  /example\.com/i,
  /localhost/i,
];

const KEEP_HINTS = [
  "lawbanks@gmail.com",
  "torqueempiresa@gmail.com",
  "roarcarssa.com",
  "torqueempire.net",
  "torqueempire.co.za",
];

const REFERENCE_TARGETS: Record<string, string> = {
  actorId: "users",
  assignedConsultantUid: "users",
  assignedUser: "users",
  authUid: "users",
  contractorId: "contractors",
  customerId: "vehicleFinanceCustomers",
  dealId: "deals",
  documentId: "documents",
  requestedBy: "users",
  uploadedBy: "users",
  userId: "users",
  vehicleId: "inventory",
};

function parseMode(): CleanupMode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringifyForSignals(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function recordLabel(id: string, data: Record<string, unknown>): string {
  const fullName = [data.firstName, data.lastName].map(asString).filter(Boolean).join(" ");
  return (
    asString(data.name) ||
    asString(data.displayName) ||
    asString(data.fullName) ||
    asString(data.email) ||
    asString(data.title) ||
    asString(data.fileName) ||
    fullName ||
    id
  );
}

function buildSearchText(id: string, data: Record<string, unknown>): string {
  const fields = [
    id,
    data.email,
    data.name,
    data.displayName,
    data.fullName,
    data.firstName,
    data.lastName,
    data.company,
    data.companyName,
    data.title,
    data.description,
    data.fileName,
    data.source,
    data.createdVia,
    data.notes,
    data.status,
  ];
  return fields.map(stringifyForSignals).join(" ").toLowerCase();
}

function collectReferences(data: Record<string, unknown>, fields: string[]): Record<string, string> {
  const references: Record<string, string> = {};
  for (const field of fields) {
    const value = asString(data[field]);
    if (value) references[field] = value;
  }
  return references;
}

function collectStoragePaths(data: Record<string, unknown>, fields: string[]): string[] {
  const paths = new Set<string>();
  for (const field of fields) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) paths.add(value.trim());
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) paths.add(item.trim());
      }
    }
  }
  return [...paths];
}

function classifyRecord(collection: string, id: string, data: Record<string, unknown>, config: CollectionScanConfig): RecordFinding {
  const searchText = buildSearchText(id, data);
  const reasons: string[] = [];
  const keepReasons: string[] = [];

  for (const pattern of TEST_PATTERNS) {
    if (pattern.test(searchText)) reasons.push(`matched ${pattern.toString()}`);
  }

  for (const hint of KEEP_HINTS) {
    if (searchText.includes(hint)) keepReasons.push(`keep hint '${hint}'`);
  }

  if (data.isTest === true || data.test === true || data.qa === true || data.mock === true || data.sample === true) {
    reasons.push("explicit test/mock/sample flag");
  }

  if (collection === "users" && asString(data.role) && !asString(data.email)) {
    keepReasons.push("user record has role but no email signal for deletion");
  }

  const references = collectReferences(data, config.referenceFields ?? []);
  const storagePaths = collectStoragePaths(data, config.storageFields ?? []);
  const hasReferences = Object.keys(references).length > 0;

  let recommendation: Recommendation = "keep";
  let riskLevel: RecordFinding["riskLevel"] = "low";

  if (reasons.length && !keepReasons.length) {
    recommendation = hasReferences || storagePaths.length ? "manual-review" : "delete";
    riskLevel = hasReferences || storagePaths.length ? "medium" : "low";
  }

  if (keepReasons.length) {
    recommendation = "keep";
    reasons.push(...keepReasons);
  }

  return {
    collection,
    path: `${collection}/${id}`,
    id,
    label: recordLabel(id, data),
    recommendation,
    reasons: reasons.length ? reasons : ["no cleanup signal"],
    riskLevel,
    references,
    storagePaths,
  };
}

function duplicateKey(collection: string, data: Record<string, unknown>): string | null {
  const email = asString(data.email).toLowerCase();
  if (email) return `${collection}:email:${email}`;
  const clientSubmissionId = asString(data.clientSubmissionId);
  if (clientSubmissionId) return `${collection}:clientSubmissionId:${clientSubmissionId}`;
  const filePath = asString(data.filePath || data.storagePath);
  if (filePath) return `${collection}:filePath:${filePath}`;
  return null;
}

function loadApprovalFile(path: string | null): ApprovalFile {
  if (!path) return { approvedRecords: [] };
  if (!existsSync(path)) throw new Error(`Approval file not found: ${path}`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ApprovalFile>;
  return { approvedRecords: Array.isArray(parsed.approvedRecords) ? parsed.approvedRecords : [] };
}

async function scanCollection(db: FirestoreDb, config: CollectionScanConfig) {
  const snapshot = await db.collection(config.name).limit(config.limit ?? 1000).get();
  const findings: RecordFinding[] = [];
  const duplicateCandidates = new Map<string, string[]>();

  for (const doc of snapshot.docs as DocumentSnapshot[]) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    findings.push(classifyRecord(config.name, doc.id, data, config));
    const key = duplicateKey(config.name, data);
    if (key) {
      const current = duplicateCandidates.get(key) ?? [];
      current.push(`${config.name}/${doc.id}`);
      duplicateCandidates.set(key, current);
    }
  }

  return {
    recordsScanned: snapshot.size,
    findings,
    duplicateCandidates,
  };
}

function buildIntegrityRisks(findings: RecordFinding[]): IntegrityRisk[] {
  const risks: IntegrityRisk[] = [];

  for (const finding of findings) {
    if (finding.recommendation === "delete" && Object.keys(finding.references).length > 0) {
      risks.push({
        level: "high",
        path: finding.path,
        message: `Deletion candidate has references: ${Object.keys(finding.references).join(", ")}`,
      });
    }

    if ((finding.recommendation === "delete" || finding.recommendation === "manual-review") && finding.storagePaths.length > 0) {
      risks.push({
        level: "medium",
        path: finding.path,
        message: `Record references storage paths that require leak cleanup verification: ${finding.storagePaths.join(", ")}`,
      });
    }
  }

  return risks;
}

function referenceTargetPath(field: string, value: string): string | null {
  const collection = REFERENCE_TARGETS[field];
  return collection ? `${collection}/${value}` : null;
}

async function verifyReferenceIntegrity(db: FirestoreDb, findings: RecordFinding[]): Promise<IntegrityRisk[]> {
  const risks: IntegrityRisk[] = [];
  const checked = new Map<string, boolean>();

  for (const finding of findings) {
    for (const [field, value] of Object.entries(finding.references)) {
      const targetPath = referenceTargetPath(field, value);
      if (!targetPath) continue;

      let exists = checked.get(targetPath);
      if (exists === undefined) {
        const snapshot = await db.doc(targetPath).get();
        exists = snapshot.exists;
        checked.set(targetPath, exists);
      }

      if (!exists) {
        risks.push({
          level: "high",
          path: finding.path,
          message: `Broken reference: ${field} points to missing ${targetPath}`,
        });
      }
    }
  }

  return risks;
}

function verifyDeletionDependencies(findings: RecordFinding[]): IntegrityRisk[] {
  const risks: IntegrityRisk[] = [];
  const deletionPaths = new Set(findings.filter((finding) => finding.recommendation === "delete").map((finding) => finding.path));

  for (const finding of findings) {
    for (const [field, value] of Object.entries(finding.references)) {
      const targetPath = referenceTargetPath(field, value);
      if (targetPath && deletionPaths.has(targetPath)) {
        risks.push({
          level: "high",
          path: finding.path,
          message: `Would reference deleted record ${targetPath} through ${field}`,
        });
      }
    }
  }

  return risks;
}

function normalizeStoragePath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    if (!trimmed.includes("storage.googleapis.com")) return null;
    const marker = ".app/";
    const markerIndex = trimmed.indexOf(marker);
    return markerIndex >= 0 ? decodeURIComponent(trimmed.slice(markerIndex + marker.length)) : null;
  }
  if (trimmed.startsWith("gs://")) {
    return trimmed.replace(/^gs:\/\/[^/]+\//, "");
  }
  return trimmed.replace(/^\/+/, "");
}

async function verifyStorageReferences(storageReferences: Array<{ path: string; source: string }>): Promise<IntegrityRisk[]> {
  const risks: IntegrityRisk[] = [];
  const { getFirebaseStorageBucket } = await import("@/lib/firebase/admin");
  const bucket = getFirebaseStorageBucket();

  for (const reference of storageReferences) {
    const normalizedPath = normalizeStoragePath(reference.path);
    if (!normalizedPath) {
      risks.push({
        level: "medium",
        path: reference.source,
        message: `Storage URL requires manual leak verification: ${reference.path}`,
      });
      continue;
    }

    const [exists] = await bucket.file(normalizedPath).exists();
    if (!exists) {
      risks.push({
        level: "medium",
        path: reference.source,
        message: `Referenced storage object does not exist: ${normalizedPath}`,
      });
    }
  }

  return risks;
}

async function deleteApprovedRecords(db: FirestoreDb, report: CleanupReport) {
  const approved = new Set(report.apply.approvedRecords);
  const candidates = report.recommendedForDeletion.filter((finding) => approved.has(finding.path));

  for (const finding of candidates) {
    if (Object.keys(finding.references).length > 0 || finding.storagePaths.length > 0) {
      report.apply.skippedRecords.push(finding.path);
      report.potentialIntegrityRisks.push({
        level: "high",
        path: finding.path,
        message: "Approved record was not deleted because it still has references or storage paths.",
      });
      continue;
    }

    await db.doc(finding.path).delete();
    report.apply.deletedRecords.push(finding.path);
  }
}

function formatMarkdown(report: CleanupReport): string {
  const lines = [
    "# Production Data Cleanup Report",
    "",
    `Mode: ${report.mode}`,
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Collections scanned: ${report.collectionsScanned.length}`,
    `- Records found: ${report.recordsFound}`,
    `- Recommended for deletion: ${report.recommendedForDeletion.length}`,
    `- Recommended to keep: ${report.recommendedToKeep.length}`,
    `- Manual review: ${report.manualReview.length}`,
    `- Potential integrity risks: ${report.potentialIntegrityRisks.length}`,
    `- Broken references: ${report.integrityVerification.brokenReferences.length}`,
    `- Storage leaks/missing objects: ${report.integrityVerification.storageLeaks.length}`,
    "",
    "## Collections Scanned",
    "",
    ...report.collectionsScanned.map((entry) => `- ${entry.collection}: ${entry.recordsScanned}`),
    "",
    "## Records Recommended For Deletion",
    "",
  ];

  if (!report.recommendedForDeletion.length) {
    lines.push("- None");
  } else {
    for (const finding of report.recommendedForDeletion) {
      lines.push(`- ${finding.path} (${finding.label})`);
      lines.push(`  Reasons: ${finding.reasons.join("; ")}`);
    }
  }

  lines.push("", "## Manual Review", "");
  if (!report.manualReview.length) {
    lines.push("- None");
  } else {
    for (const finding of report.manualReview) {
      lines.push(`- ${finding.path} (${finding.label})`);
      lines.push(`  Risk: ${finding.riskLevel}`);
      lines.push(`  Reasons: ${finding.reasons.join("; ")}`);
    }
  }

  lines.push("", "## Potential Integrity Risks", "");
  if (!report.potentialIntegrityRisks.length) {
    lines.push("- None");
  } else {
    for (const risk of report.potentialIntegrityRisks) {
      lines.push(`- [${risk.level}] ${risk.path}: ${risk.message}`);
    }
  }

  lines.push("", "## Apply Result", "");
  lines.push(`- Apply requested: ${report.apply.requested}`);
  lines.push(`- Deleted records: ${report.apply.deletedRecords.length}`);
  lines.push(`- Skipped approved records: ${report.apply.skippedRecords.length}`);

  return lines.join("\n");
}

function writeReports(report: CleanupReport) {
  const jsonPath = argValue("--report") || DEFAULT_REPORT_PATH;
  const markdownPath = argValue("--markdown-report") || DEFAULT_MARKDOWN_REPORT_PATH;
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownPath, formatMarkdown(report));
  console.log("[cleanup:report]", { jsonPath, markdownPath });
}

async function main() {
  loadEnvConfig(process.cwd());
  const mode = parseMode();
  const approvalFile = argValue("--approval-file");
  const approval = loadApprovalFile(approvalFile);
  const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
  const db = getFirebaseAdmin();
  const allFindings: RecordFinding[] = [];
  const collectionsScanned: CleanupReport["collectionsScanned"] = [];
  const duplicateGroups: CleanupReport["duplicateGroups"] = [];
  const duplicateCandidates = new Map<string, string[]>();

  console.log("[cleanup:start]", {
    mode,
    apply: mode === "apply",
    approvalFile,
  });

  if (mode === "apply" && !approval.approvedRecords.length) {
    throw new Error("--apply requires --approval-file with approvedRecords.");
  }

  for (const collection of COLLECTIONS) {
    try {
      const result = await scanCollection(db, collection);
      collectionsScanned.push({ collection: collection.name, recordsScanned: result.recordsScanned });
      allFindings.push(...result.findings);
      for (const [key, records] of result.duplicateCandidates) {
        const current = duplicateCandidates.get(key) ?? [];
        current.push(...records);
        duplicateCandidates.set(key, current);
      }
      console.log("[cleanup:collection]", { collection: collection.name, recordsScanned: result.recordsScanned });
    } catch (error) {
      allFindings.push({
        collection: collection.name,
        path: `${collection.name}/__scan_error__`,
        id: "__scan_error__",
        label: "Collection scan failed",
        recommendation: "manual-review",
        reasons: [error instanceof Error ? error.message : String(error)],
        riskLevel: "high",
        references: {},
        storagePaths: [],
      });
      console.error("[cleanup:collection-error]", { collection: collection.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const [key, records] of duplicateCandidates) {
    if (records.length > 1) {
      const [collection] = key.split(":");
      duplicateGroups.push({ collection, key, records });
    }
  }

  const storageReferences = allFindings.flatMap((finding) => finding.storagePaths.map((path) => ({ path, source: finding.path })));
  const report: CleanupReport = {
    mode,
    generatedAt: new Date().toISOString(),
    collectionsScanned,
    recordsFound: allFindings.length,
    recommendedForDeletion: allFindings.filter((finding) => finding.recommendation === "delete"),
    recommendedToKeep: allFindings.filter((finding) => finding.recommendation === "keep"),
    manualReview: allFindings.filter((finding) => finding.recommendation === "manual-review"),
    potentialIntegrityRisks: buildIntegrityRisks(allFindings),
    duplicateGroups,
    storageReferences,
    integrityVerification: {
      brokenReferences: [],
      deletionDependencyRisks: [],
      storageLeaks: [],
      runtimeIntegrityIssues: [],
    },
    apply: {
      requested: mode === "apply",
      approvalFile,
      approvedRecords: approval.approvedRecords,
      deletedRecords: [],
      skippedRecords: [],
    },
  };

  report.integrityVerification.brokenReferences = await verifyReferenceIntegrity(db, allFindings);
  report.integrityVerification.deletionDependencyRisks = verifyDeletionDependencies(allFindings);
  report.integrityVerification.storageLeaks = await verifyStorageReferences(storageReferences);
  report.integrityVerification.runtimeIntegrityIssues = [
    ...report.integrityVerification.brokenReferences,
    ...report.integrityVerification.deletionDependencyRisks,
    ...report.integrityVerification.storageLeaks,
  ];
  report.potentialIntegrityRisks.push(...report.integrityVerification.runtimeIntegrityIssues);

  for (const group of duplicateGroups) {
    report.potentialIntegrityRisks.push({
      level: "medium",
      path: group.records.join(", "),
      message: `Potential duplicate group: ${group.key}`,
    });
  }

  if (mode === "apply") {
    await deleteApprovedRecords(db, report);
  }

  writeReports(report);
  console.log("[cleanup:summary]", {
    collectionsScanned: report.collectionsScanned.length,
    recordsFound: report.recordsFound,
    recordsRecommendedForDeletion: report.recommendedForDeletion.length,
    recordsRecommendedToKeep: report.recommendedToKeep.length,
    manualReview: report.manualReview.length,
    potentialIntegrityRisks: report.potentialIntegrityRisks.length,
    deletedRecords: report.apply.deletedRecords.length,
  });
}

void main().catch((error) => {
  console.error("[cleanup:fatal]", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

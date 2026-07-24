import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  auditContractorDecisionSnapshot,
  redactAuditRecord,
  sanitizeDocumentMetadata,
  validateContractorDecisionSnapshot,
  type ContractorDecisionAuditSnapshot,
} from "@/lib/contractors/contractorDecisionAudit";
import {
  assertReadonlySnapshotExecutionAllowed,
  assertCollectorSourceReadOnly,
  createReadonlySnapshotPlan,
  parseReadonlySnapshotArgs,
} from "../../scripts/createReadonlyContractorDecisionSnapshot";
import {
  parseContractorDecisionAuditArgs,
  runContractorDecisionSnapshotAudit,
} from "../../scripts/auditContractorDecisionSnapshot";

const generatedAt = "2026-07-23T00:00:00.000Z";

function baseSnapshot(): ContractorDecisionAuditSnapshot {
  return {
    metadata: {
      generatedAt,
      environment: "production",
      projectId: "test-project",
      collectorLogicVersion: "readonly-contractor-decision-snapshot-v1",
      snapshotSchemaVersion: "contractor-decision-snapshot-v1",
      elapsedMs: 10,
    },
    contractors: [
      {
        id: "internal-id",
        collection: "contractors",
        path: "contractors/internal-id",
        data: {
          id: "internal-id",
          contractorId: "internal-id",
          companyName: "Mr K",
          contactPerson: "Mr K",
          userId: "internal-user-id",
          uid: "internal-user-id",
          authUid: "internal-user-id",
          email: "redacted@example.com",
          status: "restored",
          workspaceId: "workspace-id",
          complianceScore: 100,
          complianceStatus: "complete",
          readinessStatus: "READY",
          readinessScore: 100,
          taxpayerName: "TORQUE EMPIRE",
          csdNumber: "MISREPRESENT",
          companyRegistrationNumber: "MISREPRESENT",
          overallStatus: "Approved / Compliant",
          sarsTcsSummary: {
            verificationStatus: "VERIFIED_COMPLIANT",
            status: "VERIFIED_COMPLIANT",
            registeredTaxpayerName: "TORQUE EMPIRE",
            updatedAt: generatedAt,
          },
          recordClassification: "restored",
        },
      },
      {
        id: "te-duplicate-a",
        collection: "contractors",
        path: "contractors/te-duplicate-a",
        data: {
          id: "te-duplicate-a",
          contractorId: "te-duplicate-a",
          legalName: "Torque Empire Pty Ltd",
          taxpayerName: "Torque Empire Pty Ltd",
          workspaceId: "workspace-id",
          csdNumber: "MAAA123456",
          companyRegistrationNumber: "2024/123456/07",
          sarsTcsSummary: { verificationStatus: "VERIFIED_COMPLIANT" },
        },
      },
      {
        id: "te-duplicate-b",
        collection: "contractors",
        path: "contractors/te-duplicate-b",
        data: {
          id: "te-duplicate-b",
          contractorId: "te-duplicate-b",
          tradingName: "Torque Empire Pty Ltd",
          taxpayerName: "Torque Empire Pty Ltd",
          workspaceId: "workspace-id",
          csdNumber: "MAAA123456",
          companyRegistrationNumber: "2024/123456/07",
          sarsTcsSummary: { verificationStatus: "VERIFIED_COMPLIANT" },
        },
      },
    ],
    users: [{ id: "internal-user-id", collection: "users", path: "users/internal-user-id", data: { id: "internal-user-id", contractorId: "internal-id", role: "staff" } }],
    workspaces: [],
    deals: [{ id: "deal-1", collection: "deals", path: "deals/deal-1", data: { id: "deal-1", contractorId: "internal-id", workspaceId: "workspace-id", status: "open" } }],
    opportunities: [],
    recommendations: [{ id: "rec-1", collection: "recommendations", path: "recommendations/rec-1", data: { id: "rec-1", contractorId: "internal-id", status: "current" } }],
    assignments: [{ id: "assignment-1", collection: "assignments", path: "assignments/assignment-1", data: { id: "assignment-1", contractorId: "internal-id", status: "active" } }],
    tenderPacks: [{ id: "pack-1", collection: "tenderPacks", path: "tenderPacks/pack-1", data: { id: "pack-1", contractorId: "internal-id", status: "generated" } }],
    submissionReviews: [{ id: "review-1", collection: "submissionReviews", path: "submissionReviews/review-1", data: { id: "review-1", contractorId: "internal-id", status: "pending" } }],
    auditEvents: [{ id: "audit-1", collection: "auditLogs", path: "auditLogs/audit-1", data: { id: "audit-1", contractorId: "internal-id", eventType: "DOCUMENT_UPLOADED" } }],
    activityRecords: [],
    contractorDocuments: [
      { id: "taxClearance", collection: "contractors.documents", path: "contractors/internal-id/documents/taxClearance", contractorId: "internal-id", documentType: "taxClearance", data: { id: "taxClearance", contractorId: "internal-id", documentType: "taxClearance", status: "verified", verified: true, updatedAt: generatedAt } },
      { id: "cipc", collection: "contractors.documents", path: "contractors/internal-id/documents/cipc", contractorId: "internal-id", documentType: "cipc", data: { id: "cipc", contractorId: "internal-id", documentType: "cipc", status: "verified", verified: true, updatedAt: generatedAt } },
      { id: "orphan", collection: "contractorDocuments", path: "contractorDocuments/orphan", contractorId: null, documentType: "taxClearance", data: { id: "orphan", contractorName: "Mr K", documentType: "taxClearance", status: "verified" } },
    ],
    relationships: [
      { sourceType: "user", sourceId: "internal-user-id", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "users/internal-user-id" },
      { sourceType: "deal", sourceId: "deal-1", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "deals/deal-1" },
      { sourceType: "recommendation", sourceId: "rec-1", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "recommendations/rec-1" },
      { sourceType: "assignment", sourceId: "assignment-1", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "assignments/assignment-1" },
      { sourceType: "tenderPack", sourceId: "pack-1", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "tenderPacks/pack-1" },
      { sourceType: "submissionReview", sourceId: "review-1", targetType: "contractor", targetId: "internal-id", relationshipType: "contractorId", evidenceSource: "submissionReviews/review-1" },
      { sourceType: "auditEvent", sourceId: "audit-1", targetType: "contractor", targetId: "missing-contractor", relationshipType: "contractorId", evidenceSource: "auditLogs/audit-1" },
    ],
    collectionStatistics: { contractors: { records: 3, path: "contractors" } },
    queryStatistics: { collectionReads: 1, documentReads: 0, queryCount: 1, subcollectionReads: 0, nPlusOnePatterns: [] },
  };
}

describe("contractor decision audit tooling", () => {
  it("proves the collector source has no remote write or Auth/Storage mutation path", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts", "createReadonlyContractorDecisionSnapshot.ts"), "utf8");
    expect(source).not.toMatch(/\.(set|update|delete|create|add|batch|bulkWriter|runTransaction)\s*\(/);
    expect(source).not.toContain("firebase-admin/auth");
    expect(source).not.toContain("firebase-admin/storage");
    expect(source).not.toContain("getFirebaseStorageBucket");
    expect(() => assertCollectorSourceReadOnly(source)).not.toThrow();
  });

  it("requires explicit contractor-scoped execution", () => {
    expect(() => parseReadonlySnapshotArgs([])).toThrow(/contractor-id/);
    expect(() => parseReadonlySnapshotArgs(["--contractor-id=   "])).toThrow(/contractor-id/);
    for (const flag of ["--all", "--broad", "--scan-all", "--limit=2", "--allowlist=a"]) expect(() => parseReadonlySnapshotArgs([flag])).toThrow(/unsafe snapshot option/);
    expect(() => parseReadonlySnapshotArgs(["--contractor-id=mr-k-id", "--allow-bounded-scan=deals"])).toThrow(/unsafe snapshot option/);
    expect(parseReadonlySnapshotArgs(["--contractor-id=mr-k-id", "--plan-only"]).contractorId).toBe("mr-k-id");
  });

  it("refuses production collection without confirmation or when relationships remain unresolved", () => {
    expect(() => assertReadonlySnapshotExecutionAllowed(parseReadonlySnapshotArgs(["--contractor-id=mr-k-id"]))).toThrow(/Refusing execution/);
    expect(() => assertReadonlySnapshotExecutionAllowed(parseReadonlySnapshotArgs(["--production", "--output=reports/a.json", "--contractor-id=mr-k-id"]))).toThrow(/Refusing execution/);
  });

  it("reports unresolved relationships without broad scans", () => {
    const plan = createReadonlySnapshotPlan(parseReadonlySnapshotArgs(["--plan-only", "--contractor-id=mr-k-id"]));
    expect(plan.mode).toBe("scoped");
    expect(plan.topLevelCollectionReads).not.toContain("contractors");
    expect(plan.boundedScansRequired).toEqual([]);
    expect(plan.unresolvedRelationshipPaths).toEqual(expect.arrayContaining(["recommendations", "assignments"]));
    expect(plan.productionExecutionAllowed).toBe(false);
    expect(plan.predictedQueryPattern.limitApplied).toBeNull();
  });

  it("source guard rejects Firestore write-capable collector code", () => {
    expect(() => assertCollectorSourceReadOnly()).not.toThrow();
    expect(() => assertCollectorSourceReadOnly("db.collection(\"contractors\").set({});")).toThrow(/write-capable|forbidden/);
  });

  it("redacts artificial sensitive tokens", () => {
    const redacted = redactAuditRecord({ taxReferenceNumber: "TEST-TAX-ID-ALPHA", idNumber: "TEST-PERSON-ID-BETA" });
    expect(JSON.stringify(redacted)).not.toContain("TEST-TAX-ID-ALPHA");
    expect(JSON.stringify(redacted)).not.toContain("TEST-PERSON-ID-BETA");
  });

  it("redacts sensitive fields and drops unknown future fields", () => {
    const redacted = redactAuditRecord({
      companyName: "Torque Empire",
      email: "owner@example.com",
      phone: "+27000000000",
      token: "secret-token",
      unknownFutureField: "must-not-leak",
      sarsTcsSummary: { taxReferenceNumber: "TEST-TAX-ID-ALPHA", verificationStatus: "PENDING" },
    });
    expect(redacted).toEqual({
      companyName: "Torque Empire",
      businessEmailDomain: "example.com",
      sarsTcsSummary: { verificationStatus: "PENDING" },
    });
    expect(JSON.stringify(redacted)).not.toContain("secret-token");
    expect(JSON.stringify(redacted)).not.toContain("TEST-TAX-ID-ALPHA");
    expect(JSON.stringify(redacted)).not.toContain("unknownFutureField");
  });

  it("sanitizes document metadata without raw contents or paths", () => {
    const metadata = sanitizeDocumentMetadata({
      documentType: "taxClearance",
      status: "verified",
      fileUrl: "https://storage.example/private.pdf",
      ocrText: "private document contents",
      idNumber: "TEST-PERSON-ID-BETA",
      unknownFutureField: "must-not-leak",
    });
    expect(metadata).toEqual({ documentType: "taxClearance", status: "verified" });
  });

  it("validates the snapshot schema", () => {
    expect(validateContractorDecisionSnapshot(baseSnapshot())).toBe(true);
    expect(validateContractorDecisionSnapshot({ contractors: [] })).toBe(false);
  });

  it("classifies Mr K-style identity conflict, invalid CSD/CIPC, stale READY, and linked workflow severity", () => {
    const report = auditContractorDecisionSnapshot(baseSnapshot());
    const mrK = report.contractors.find((contractor) => contractor.contractorId === "internal-id");
    expect(mrK).toBeDefined();
    expect(mrK).toEqual(expect.objectContaining({
      safeDisplayLabel: "Mr K",
      identityStatus: "CONFLICT",
      csdStatus: "INVALID",
      cipcStatus: "INVALID",
      currentReadinessScore: null,
      currentReadinessDecision: "STALE",
      assignmentAllowed: false,
      externalVerificationStatus: "VERIFIED_COMPLIANT",
      riskClassification: "CRITICAL",
      manualBusinessVerificationRequired: true,
    }));
    expect(mrK?.historicalDecision).toEqual(expect.objectContaining({ readinessScore: 100, readinessStatus: "READY", complianceStatus: "complete" }));
    expect(mrK?.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "IDENTITY_CONFLICT",
      "PERSONAL_NAME_BUSINESS_IDENTITY",
      "TAXPAYER_BUSINESS_MISMATCH",
      "INVALID_OR_UNRESOLVED_CSD",
      "INVALID_OR_UNRESOLVED_CIPC",
      "HISTORICAL_READY_NOW_BLOCKED",
      "LINKED_ACTIVE_ASSIGNMENT",
      "LINKED_ACTIVE_TENDER_PACK",
      "DOCUMENT_OWNERSHIP_CONFLICT",
    ]));
    expect(mrK?.knownContext).toEqual(expect.arrayContaining([
      "Mr K was intentionally used as a test contractor identity.",
      "Historical workflow evidence must be preserved before any repair.",
    ]));
  });

  it("detects duplicate candidates and orphaned relationships deterministically", () => {
    const first = auditContractorDecisionSnapshot(baseSnapshot());
    const second = auditContractorDecisionSnapshot(baseSnapshot());
    expect(first.duplicateCandidates).toEqual(second.duplicateCandidates);
    expect(first.duplicateCandidates.some((group) => group.contractorIds.includes("te-duplicate-a") && group.contractorIds.includes("te-duplicate-b"))).toBe(true);
    expect(first.orphanedRelationships).toEqual([expect.objectContaining({ targetId: "missing-contractor" })]);
  });

  it("writes deterministic JSON and Markdown reports with no secrets", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "teos-contractor-audit-"));
    const input = path.join(dir, "snapshot.json");
    const json = path.join(dir, "audit.json");
    const markdown = path.join(dir, "audit.md");
    fs.writeFileSync(input, JSON.stringify(baseSnapshot(), null, 2), "utf8");
    const result = runContractorDecisionSnapshotAudit(parseContractorDecisionAuditArgs([`--input=${input}`, `--json=${json}`, `--markdown=${markdown}`]));
    expect(result.summary.totalContractorsReviewed).toBe(3);
    expect(fs.existsSync(json)).toBe(true);
    expect(fs.existsSync(markdown)).toBe(true);
    const combined = `${fs.readFileSync(json, "utf8")}\n${fs.readFileSync(markdown, "utf8")}`;
    expect(combined).not.toContain("redacted@example.com");
    expect(combined).not.toContain("+27000000000");
    expect(combined).not.toContain("secret-token");
    expect(fs.readFileSync(markdown, "utf8")).toContain("Contractor Decision Audit");
  });
});



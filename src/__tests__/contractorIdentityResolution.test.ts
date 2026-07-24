import fs from "node:fs";
import path from "node:path";
import {
  ContractorIdentityResolutionError,
  computeContractorIdentitySourceFingerprint,
  fingerprintContractorIdentityBeforeState,
  prepareContractorManualIdentityResolutionProposal,
  stableStringifyContractorIdentityResolution,
  type ContractorManualIdentityResolutionInput,
} from "@/lib/contractors/contractorIdentityResolution";
import type {
  ContractorDecisionAuditReport,
  ContractorDecisionAuditSnapshot,
} from "@/lib/contractors/contractorDecisionAudit";
import {
  CONTRACTOR_IDENTITY_RESOLUTION_USAGE,
  parseContractorIdentityResolutionArgs,
  prepareContractorIdentityResolutionFromCli,
  resolveSafeContractorIdentityOutputPath,
} from "../../scripts/prepareContractorIdentityResolution";

const contractorId = "z0yX8cyt38hkfa60UEyNTOiX2812";
const reviewedAt = "2026-07-24T10:00:00.000Z";

function snapshot(overrides: Record<string, unknown> = {}): ContractorDecisionAuditSnapshot {
  return {
    metadata: {
      generatedAt: "2026-07-23T15:32:11.153Z",
      environment: "production",
      projectId: null,
      collectorLogicVersion: "readonly-contractor-decision-snapshot-v2; audit=contractor-decision-audit-v1",
      snapshotSchemaVersion: "contractor-decision-snapshot-v1",
    },
    contractors: [
      {
        id: contractorId,
        collection: "contractors",
        path: `contractors/${contractorId}`,
        data: {
          id: contractorId,
          contractorId,
          uid: contractorId,
          authUid: contractorId,
          userId: contractorId,
          companyName: "Mr K",
          name: "Mr K",
          workspaceId: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001",
          companyRegistrationNumber: "2024/105084/07",
          registrationNumber: "2024/105084/07",
          csdNumber: "MISREPRESENT",
          mNumber: "MISREPRESENT",
          readinessScore: 100,
          readinessStatus: "READY",
          complianceStatus: "complete",
          complianceApproved: true,
          readinessUpdatedAt: "2026-07-22T19:14:43.574Z",
          taxpayerName: "TORQUE EMPIRE",
          sarsTcsSummary: {
            registeredTaxpayerName: "Torque Empire Pty Ltd",
            verificationStatus: "VERIFIED_COMPLIANT",
          },
          ...overrides,
        },
      },
    ],
    users: [
      {
        id: contractorId,
        collection: "users",
        path: `users/${contractorId}`,
        data: { id: contractorId, uid: contractorId, contractorId, role: "admin", name: "Mr K" },
      },
    ],
    workspaces: [],
    deals: [],
    opportunities: [],
    recommendations: [],
    assignments: [],
    tenderPacks: [],
    submissionReviews: [],
    auditEvents: [],
    activityRecords: [],
    contractorDocuments: [],
    relationships: [],
    collectionStatistics: {},
    queryStatistics: { collectionReads: 0, documentReads: 1, queryCount: 1, subcollectionReads: 0, nPlusOnePatterns: [] },
  };
}

function audit(overrides: Record<string, unknown> = {}): ContractorDecisionAuditReport {
  return {
    metadata: {
      generatedAt: "2026-07-23T15:32:11.153Z",
      auditLogicVersion: "contractor-decision-audit-v1",
      snapshotSchemaVersion: "contractor-decision-snapshot-v1",
      sourceGeneratedAt: "2026-07-23T15:32:11.153Z",
    },
    summary: {
      totalContractorsReviewed: 1,
      countsBySeverity: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 },
      suspectContractors: 1,
      duplicateCandidateGroups: 0,
      affectedDeals: 0,
      affectedRecommendations: 0,
      affectedAssignments: 0,
      affectedTenderPacks: 0,
      affectedSubmissionReviews: 0,
      staleDecisionCount: 1,
      invalidCsdCount: 1,
      invalidCipcCount: 0,
      workspaceIssueCount: 0,
      staffAdminContaminationCount: 0,
      orphanedRelationshipCount: 0,
      rawRecordsByCategory: {},
      eventDeduplication: {
        rawEventCount: 0,
        deduplicatedEventCount: 0,
        duplicateCountRemoved: 0,
        deduplicationKey: "test",
        rawRecordsByCategory: {},
        sourceCollections: [],
      },
    },
    contractors: [
      {
        contractorId,
        workspaceId: "0bcd72d2-5f25-4c83-a1d2-8f8f1c5d9001",
        safeDisplayLabel: "Mr K",
        identityStatus: "CONFLICT",
        identityResolved: null,
        identityMatchStatus: "CONFLICT",
        cipcStatus: "VALID",
        csdStatus: "INVALID",
        externalVerificationStatus: "VERIFIED_COMPLIANT",
        documentCompleteness: 100,
        currentReadinessDecision: "STALE",
        currentReadinessScore: null,
        assignmentAllowed: false,
        historicalDecision: {
          readinessScore: 100,
          readinessStatus: "READY",
          complianceStatus: "complete",
          complianceApproved: true,
          logicVersion: null,
        },
        decisionTimestamp: "2026-07-22T19:14:43.574Z",
        logicVersion: null,
        stale: true,
        blockingReasons: ["SARS taxpayer name does not match contractor business identity"],
        linkedUserRelationshipType: "none",
        linkedDeals: [],
        linkedOpportunities: [],
        linkedRecommendations: [],
        linkedAssignments: [],
        linkedTenderPacks: [],
        linkedSubmissionReviews: [],
        linkedDocumentsCount: 6,
        relationshipBreakdown: {},
        evidenceSummary: {
          storedIdentityFields: { companyName: "Mr K", name: "Mr K" },
          businessIdentityEvidence: {
            taxpayerName: "TORQUE EMPIRE",
            registeredTaxpayerName: "Torque Empire Pty Ltd",
            companyRegistrationNumber: "2024/105084/07",
            csdNumber: "MISREPRESENT",
          },
          ownsUploadedDocumentsDirectly: true,
          separateCanonicalTorqueEmpireRecordAppears: false,
          activeAssignmentEvidence: false,
          tenderPackGenerated: false,
          submissionCompleted: false,
          documentOwnershipConflict: false,
          orphanedRecordsExist: true,
          missingWorkspaceRepairBlocker: false,
          opportunityExecutionRecordsPresent: false,
          retainedInternalIdsRequiredForAllowlist: true,
        },
        auditActivityReferences: [],
        findings: [],
        riskClassification: "HIGH",
        recommendedFutureAction: "Manual business verification and allowlisted repair design required. Do not mutate records from this report.",
        manualBusinessVerificationRequired: true,
        ...overrides,
      },
    ],
    duplicateCandidates: [],
    orphanedRelationships: [],
    recommendedRemediationGroups: [],
    remediationOptions: [],
    proposedFirstRepairCandidates: [],
    markdown: "",
  };
}

function validInput(overrides: Partial<ContractorManualIdentityResolutionInput> = {}): ContractorManualIdentityResolutionInput {
  const sourceSnapshot = (overrides.snapshot as ContractorDecisionAuditSnapshot | undefined) ?? snapshot();
  const auditReport = (overrides.auditReport as ContractorDecisionAuditReport | undefined) ?? audit();
  const base = {
    contractorId,
    snapshot: sourceSnapshot,
    auditReport,
    sourceSnapshotPath: "reports/contractors/readonly-production-snapshot-mrk.json",
    sourceAuditPath: "reports/contractors/contractor-decision-audit-mrk.json",
    approvedLegalBusinessName: "Torque Empire Pty Ltd",
    approvedTradingName: "Torque Empire",
    reviewerIdentity: "reviewer-1",
    reviewerRole: "admin",
    reason: "Manual review confirms business identity from CIPC and SARS evidence; CSD remains unresolved.",
    reviewedAt,
    expectedBeforeStateFingerprint: computeContractorIdentitySourceFingerprint({ contractorId, snapshot: sourceSnapshot, auditReport }),
    verifiedBusinessIdentityEvidencePath: "reports/contractors/verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json",
    verifiedBusinessIdentityEvidence: { contractorDocumentId: contractorId, contractorIsolationStatus: "VERIFIED", verificationStatus: "VERIFIED", legalBusinessName: "TORQUE EMPIRE (PTY) LTD", companyRegistrationNumber: "2024/105084/07", primarySourceDocumentSHA256: "170AA775C2F97F2C68D976C098C71E08EA291D3C7E41300592BBDF36FFA787C4", supportingSourceDocumentSHA256: "D35E6EE08179B83F90903DA5BF5F4B48E574462BB18E28FF61AB8370AE1AFC4A" },
    evidenceSourcesReviewed: [
      `contractors/${contractorId}`,
      "reports/contractors/readonly-production-snapshot-mrk.json",
      "reports/contractors/contractor-decision-audit-mrk.json",
    ],
  } satisfies ContractorManualIdentityResolutionInput;
  return { ...base, ...overrides };
}

function expectBlocked(input: ContractorManualIdentityResolutionInput, code: string): void {
  expect(() => prepareContractorManualIdentityResolutionProposal(input)).toThrow(ContractorIdentityResolutionError);
  try {
    prepareContractorManualIdentityResolutionProposal(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ContractorIdentityResolutionError);
    expect((error as ContractorIdentityResolutionError).code).toBe(code);
  }
}

describe("contractor manual identity resolution", () => {
  it("builds a valid manually reviewed dry-run proposal", () => {
    const proposal = prepareContractorManualIdentityResolutionProposal(validInput());
    expect(proposal).toEqual(expect.objectContaining({
      mode: "DRY_RUN_ONLY",
      productionWriteOccurred: false,
      contractorDocumentId: contractorId,
      resolutionState: "MANUALLY_RESOLVED",
      approvedLegalBusinessName: "Torque Empire Pty Ltd",
      companyRegistrationNumber: "2024/105084/07",
    }));
    expect(proposal.proposedAfterState).toEqual(expect.objectContaining({
      identityStatus: "MANUALLY_RESOLVED",
      identityResolved: true,
      identityMatchStatus: "MATCHED_BY_MANUAL_REVIEW",
    }));
    expect(proposal.proposedAfterState.canonicalContractorFacingReference).toEqual({ status: "NOT_ISSUED", value: null });
  });

  it("fails closed when reviewer is missing", () => {
    expectBlocked(validInput({ reviewerIdentity: "" }), "REVIEWER_REQUIRED");
  });

  it("fails closed when reason is missing", () => {
    expectBlocked(validInput({ reason: "" }), "REASON_REQUIRED");
  });

  it("fails closed for a non-allowlisted contractor", () => {
    expectBlocked(validInput({ contractorId: "other-contractor" }), "CONTRACTOR_NOT_ALLOWLISTED");
  });

  it("fails closed when the expected source fingerprint has changed", () => {
    expectBlocked(validInput({ expectedBeforeStateFingerprint: "not-the-current-fingerprint" }), "SOURCE_FINGERPRINT_CHANGED");
  });

  it("fails closed when CIPC status is invalid", () => {
    expectBlocked(validInput({ auditReport: audit({ cipcStatus: "INVALID" }) }), "CIPC_INVALID_OR_MISSING");
  });

  it("fails closed when a supplied CSD value is invalid", () => {
    expectBlocked(validInput({ approvedCsdSupplierNumber: "MISREPRESENT" }), "CSD_INVALID");
  });

  it("fails closed on attempted contractor reference issuance", () => {
    expectBlocked(validInput({ proposedCanonicalContractorReference: "TEOS-CON-00001" }), "CONTRACTOR_REFERENCE_ISSUANCE_BLOCKED");
  });

  it("fails closed on attempted readiness update", () => {
    expectBlocked(validInput({ proposedForbiddenAuthorityFields: { readinessScore: 100 } }), "READINESS_AUTHORITY_UPDATE_BLOCKED");
  });

  it("fails closed on attempted compliance update", () => {
    expectBlocked(validInput({ proposedForbiddenAuthorityFields: { complianceApproved: true } }), "COMPLIANCE_AUTHORITY_UPDATE_BLOCKED");
  });

  it("fails closed on attempted assignment permission", () => {
    expectBlocked(validInput({ proposedForbiddenAuthorityFields: { assignmentAllowed: true } }), "ASSIGNMENT_AUTHORITY_UPDATE_BLOCKED");
  });

  it("fails closed on accidental reuse of Auth UID as business identity", () => {
    expectBlocked(validInput({ approvedLegalBusinessName: contractorId }), "NAMESPACE_REUSE_BLOCKED");
  });

  it("fails closed on accidental reuse of CIPC or CSD number as business identity", () => {
    expectBlocked(validInput({ approvedLegalBusinessName: "2024/105084/07" }), "NAMESPACE_REUSE_BLOCKED");
    expectBlocked(validInput({ approvedLegalBusinessName: "MISREPRESENT" }), "NAMESPACE_REUSE_BLOCKED");
  });

  it("keeps historical 100 and READY values non-authoritative", () => {
    const proposal = prepareContractorManualIdentityResolutionProposal(validInput());
    expect(proposal.historicalDecisionHandling).toEqual(expect.objectContaining({
      readinessScore: 100,
      readinessStatus: "READY",
      complianceStatus: "complete",
      complianceApproved: true,
      logicVersion: null,
      authoritative: false,
      action: "REPORT_ONLY_DO_NOT_UPDATE_RESTORE_OR_LEGITIMISE",
    }));
    expect(proposal.proposedAfterState.readinessAuthority).toBe("UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED");
    expect(proposal.proposedAfterState.complianceAuthority).toBe("UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED");
    expect(proposal.proposedAfterState.assignmentAuthority).toBe("UNCHANGED_ASSIGNMENT_REMAINS_BLOCKED_UNTIL_SEPARATE_DECISION");
  });

  it("repeat dry-run produces an identical proposal", () => {
    const first = prepareContractorManualIdentityResolutionProposal(validInput());
    const second = prepareContractorManualIdentityResolutionProposal(validInput());
    expect(stableStringifyContractorIdentityResolution(first)).toBe(stableStringifyContractorIdentityResolution(second));
    expect(fingerprintContractorIdentityBeforeState(first.beforeState)).toBe(first.beforeStateFingerprint);
  });
  it("fails closed when expected fingerprint is missing or blank", () => {
    expectBlocked({ ...(validInput() as any), expectedBeforeStateFingerprint: undefined }, "EXPECTED_FINGERPRINT_REQUIRED");
    expectBlocked(validInput({ expectedBeforeStateFingerprint: "" }), "EXPECTED_FINGERPRINT_REQUIRED");
  });
  it("succeeds with the correct expected fingerprint and fails with an incorrect one", () => {
    const input = validInput();
    expect(prepareContractorManualIdentityResolutionProposal(input).beforeStateFingerprint).toBe(input.expectedBeforeStateFingerprint);
    expectBlocked(validInput({ expectedBeforeStateFingerprint: "not-the-current-fingerprint" }), "SOURCE_FINGERPRINT_CHANGED");
  });

  it("rejects unsafe output paths and accepts reports/contractors JSON output", () => {
    expect(() => resolveSafeContractorIdentityOutputPath(path.resolve(process.cwd(), "outside.json"))).toThrow(/reports/);
    expect(() => resolveSafeContractorIdentityOutputPath("reports/contractors/../outside.json")).toThrow(/traversal/);
    expect(() => resolveSafeContractorIdentityOutputPath("reports\\contractors\\..\\..\\scripts\\proposal.json")).toThrow(/traversal/);
    expect(() => resolveSafeContractorIdentityOutputPath("reports/contractors/%2e%2e/scripts/proposal.json")).toThrow(/traversal/);
    expect(() => resolveSafeContractorIdentityOutputPath("reports/contractors/proposal.txt")).toThrow(/\.json/);
    expect(resolveSafeContractorIdentityOutputPath("reports/contractors/proposal.json")).toBe(path.resolve(process.cwd(), "reports", "contractors", "proposal.json"));
  });
});
it("CLI refuses reviewedAt arguments in normal execution", () => { expect(() => prepareContractorIdentityResolutionFromCli(parseContractorIdentityResolutionArgs(["--reviewed-at=2026-01-01T00:00:00.000Z"]))).toThrow(/reviewedAt/); expect(CONTRACTOR_IDENTITY_RESOLUTION_USAGE).not.toContain("--reviewed-at"); });
it("CLI clock injection generates UTC reviewedAt", () => { const d=path.join(process.cwd(),"reports","contractors",".clock-"+Date.now()); fs.mkdirSync(d,{recursive:true}); const sp=path.join(d,"s.json"), ap=path.join(d,"a.json"), op=path.join(d,"p.json"); fs.writeFileSync(sp,JSON.stringify(snapshot()),"utf8"); fs.writeFileSync(ap,JSON.stringify(audit()),"utf8"); const fp=validInput().expectedBeforeStateFingerprint; try { const r=prepareContractorIdentityResolutionFromCli(parseContractorIdentityResolutionArgs(["--contractor-id="+contractorId,"--snapshot="+sp,"--audit="+ap,"--approved-legal-business-name=Torque Empire Pty Ltd","--reviewer-identity=reviewer-1","--reviewer-role=admin","--reason=Manual review.","--expected-before-state-fingerprint="+fp,"--evidence-sources-reviewed="+sp+","+ap,"--verified-business-identity-evidence="+path.join(process.cwd(),"reports","contractors","verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json"),"--output="+op]),()=>new Date("2026-07-24T13:14:15.016Z")); expect(r.proposal.reviewedAt).toBe("2026-07-24T13:14:15.016Z"); expect(r.proposal.beforeStateFingerprint).toBe(fp); } finally { fs.rmSync(d,{recursive:true,force:true}); } });
it("CLI output is idempotent only for identical content", () => { const d=path.join(process.cwd(),"reports","contractors",".idem-"+Date.now()); fs.mkdirSync(d,{recursive:true}); const sp=path.join(d,"s.json"), ap=path.join(d,"a.json"), op=path.join(d,"p.json"); fs.writeFileSync(sp,JSON.stringify(snapshot()),"utf8"); fs.writeFileSync(ap,JSON.stringify(audit()),"utf8"); const fp=validInput().expectedBeforeStateFingerprint; const args=parseContractorIdentityResolutionArgs(["--contractor-id="+contractorId,"--snapshot="+sp,"--audit="+ap,"--approved-legal-business-name=Torque Empire Pty Ltd","--reviewer-identity=reviewer-1","--reviewer-role=admin","--reason=Manual review.","--expected-before-state-fingerprint="+fp,"--evidence-sources-reviewed="+sp+","+ap,"--verified-business-identity-evidence="+path.join(process.cwd(),"reports","contractors","verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json"),"--output="+op]); const clock=()=>new Date("2026-07-24T12:34:56.789Z"); try { expect(prepareContractorIdentityResolutionFromCli(args,clock).writeStatus).toBe("created"); expect(prepareContractorIdentityResolutionFromCli(args,clock).writeStatus).toBe("existing_identical"); fs.writeFileSync(op,"different","utf8"); expect(()=>prepareContractorIdentityResolutionFromCli(args,clock)).toThrow(/overwrite/); } finally { fs.rmSync(d,{recursive:true,force:true}); } });
it("CLI requires expected before-state fingerprint", () => { const d=path.join(process.cwd(),"reports","contractors",".fp-"+Date.now()); fs.mkdirSync(d,{recursive:true}); const sp=path.join(d,"s.json"), ap=path.join(d,"a.json"), op=path.join(d,"p.json"); fs.writeFileSync(sp,JSON.stringify(snapshot()),"utf8"); fs.writeFileSync(ap,JSON.stringify(audit()),"utf8"); try { expect(()=>prepareContractorIdentityResolutionFromCli(parseContractorIdentityResolutionArgs(["--contractor-id="+contractorId,"--snapshot="+sp,"--audit="+ap,"--approved-legal-business-name=Torque Empire Pty Ltd","--reviewer-identity=reviewer-1","--reviewer-role=admin","--reason=Manual review.","--evidence-sources-reviewed="+sp+","+ap,"--verified-business-identity-evidence="+path.join(process.cwd(),"reports","contractors","verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json"),"--output="+op]))).toThrow(/expected-before-state-fingerprint/); } finally { fs.rmSync(d,{recursive:true,force:true}); } });
it("requires verified evidence contractor isolation, identity, registration, and hashes", () => {
  const base = validInput();
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["another contractor", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, contractorDocumentId: "other" } }, "VERIFIED_EVIDENCE_CONTRACTOR_MISMATCH"],
    ["unverified artifact", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, verificationStatus: "REVIEW" } }, "VERIFIED_EVIDENCE_STATUS_REQUIRED"],
    ["unisolated artifact", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, contractorIsolationStatus: "UNVERIFIED" } }, "VERIFIED_EVIDENCE_ISOLATION_REQUIRED"],
    ["legal-name mismatch", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, legalBusinessName: "OTHER BUSINESS (PTY) LTD" } }, "VERIFIED_EVIDENCE_LEGAL_NAME_MISMATCH"],
    ["registration mismatch", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, companyRegistrationNumber: "2024/000000/00" } }, "VERIFIED_EVIDENCE_REGISTRATION_MISMATCH"],
    ["primary hash mismatch", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, primarySourceDocumentSHA256: "0".repeat(64) } }, "VERIFIED_EVIDENCE_PRIMARY_HASH_MISMATCH"],
    ["supporting hash mismatch", { verifiedBusinessIdentityEvidence: { ...base.verifiedBusinessIdentityEvidence, supportingSourceDocumentSHA256: "0".repeat(64) } }, "VERIFIED_EVIDENCE_SUPPORTING_HASH_MISMATCH"],
    ["missing artifact", { verifiedBusinessIdentityEvidence: undefined }, "VERIFIED_EVIDENCE_REQUIRED"],
  ];
  for (const [label, overrides, code] of cases) {
    expectBlocked(validInput(overrides as Partial<ContractorManualIdentityResolutionInput>), code);
  }
});

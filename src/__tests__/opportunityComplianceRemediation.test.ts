import {
  buildOpportunityExecutionState,
  deriveOpportunityPhase,
  evaluateOpportunityCompliance,
  extractOpportunityRequirements,
  matchContractorsForOpportunity,
} from "@/lib/opportunities/opportunityExecution";

const future = Date.parse("2026-12-31T00:00:00.000Z");
const past = Date.parse("2026-06-30T00:00:00.000Z");

const deal = {
  id: "deal-1",
  title: "Cleaning RFQ",
  category: "cleaning",
  workspaceId: "workspace-a",
  closingDate: "2026-08-01T11:00:00.000Z",
  tenderAnalysis: { requiredCertificates: ["Tax compliance", "CSD"], location: "Western Cape" },
  opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true }, complianceReviewed: true, contractorId: "c1", executionWorkspaceId: "exec-deal-1" },
  contractorAssignment: { contractorId: "c1", contractorName: "Torque Empire PTY Ltd", assignedAt: "2026-07-16T10:00:00.000Z", assignedBy: "staff-1", assignmentStatus: "assigned", workspaceId: "workspace-a", executionWorkspaceId: "exec-deal-1" },
  contractorId: "c1",
};

const baseContractor = {
  id: "c1",
  contractorId: "c1",
  companyName: "Torque Empire PTY Ltd",
  registrationNumber: "REG-1",
  taxNumber: "TAX-1",
  csdNumber: "MAAA0001",
  contactEmail: "ops@example.com",
  phone: "0210000000",
  workspaceId: "workspace-a",
  serviceCategories: ["cleaning"],
  regions: ["Western Cape"],
  readinessScore: 100,
};

function doc(overrides: Record<string, unknown>) {
  return {
    id: "doc-1",
    contractorId: "c1",
    workspaceId: "workspace-a",
    documentType: "taxClearance",
    fileName: "Tax Compliance Status Letter.pdf",
    fileUrl: "https://example.com/doc.pdf",
    uploadedAt: Date.parse("2026-07-01T00:00:00.000Z"),
    expiresAt: future,
    verified: true,
    status: "verified",
    ...overrides,
  };
}

function statusFor(contractor: Record<string, unknown>, key: string) {
  const result = evaluateOpportunityCompliance(extractOpportunityRequirements(deal), contractor, "workspace-a");
  return result.details.find((detail) => detail.key === key);
}

describe("opportunity compliance remediation", () => {
  test("existing valid Tax document is recognised", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({})] }, "tax")).toMatchObject({ status: "VALID", reason: "Valid Tax Compliance found" });
  });

  test("existing valid CSD document is recognised", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ id: "csd-1", documentType: "csd", fileName: "CSD Registration Report.pdf" })] }, "csd")).toMatchObject({ status: "VALID" });
  });

  test("unverified document shows UNVERIFIED, not MISSING", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ verified: false, status: "uploaded" })] }, "tax")).toMatchObject({ status: "UNVERIFIED", requiredAction: "Verify document" });
  });

  test("expired document shows EXPIRED", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ expiresAt: past })] }, "tax")).toMatchObject({ status: "EXPIRED" });
  });

  test("wrong-contractor document shows WRONG_CONTRACTOR", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ contractorId: "c-other" })] }, "tax")).toMatchObject({ status: "WRONG_CONTRACTOR" });
  });

  test("unclassified document shows UNCLASSIFIED", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ documentType: "unknown", fileName: "Tax Compliance Status Letter.pdf" })] }, "tax")).toMatchObject({ status: "UNCLASSIFIED", requiredAction: "Reclassify document" });
  });

  test("duplicate contractor records do not silently mix documents", () => {
    const detail = statusFor({ ...baseContractor, documents: [doc({ contractorId: "c-duplicate", fileName: "Tax duplicate.pdf" })] }, "tax");
    expect(detail).toMatchObject({ status: "WRONG_CONTRACTOR" });
    expect(detail?.reason).toBe("Tax Compliance document belongs to another contractor record");
  });

  test("profile completeness is separate from submission readiness", () => {
    const state = buildOpportunityExecutionState({ deal, contractor: { ...baseContractor, documents: [doc({})] } });
    expect(state.profileCompleteness).toBeGreaterThan(0);
    expect(state.submissionReadiness).toBeLessThanOrEqual(100);
    expect(state.profileCompleteness).not.toBe(state.submissionReadiness);
  });

  test("missing requirement creates one remediation request", () => {
    const state = buildOpportunityExecutionState({ deal, contractor: { ...baseContractor, documents: [] } });
    expect(state.remediationRequests.filter((request) => request.requirementKey === "tax")).toHaveLength(1);
  });

  test("retry does not create duplicate requests", () => {
    const existing = [{ id: "existing", opportunityId: "deal-1", dealId: "deal-1", contractorId: "c1", requirement: "Tax Compliance", requirementKey: "tax" as const, dueDate: null, assignedStaffMember: null, status: "draft" as const, surfaces: ["execution_workspace" as const] }];
    const state = buildOpportunityExecutionState({ deal: { ...deal, opportunityExecution: { ...deal.opportunityExecution, complianceRequests: existing } }, contractor: { ...baseContractor, documents: [] } });
    expect(state.remediationRequests.filter((request) => request.requirementKey === "tax")).toHaveLength(1);
  });

  test("approved upload clears the blocker", () => {
    const state = buildOpportunityExecutionState({ deal, contractor: { ...baseContractor, documents: [doc({}), doc({ id: "csd-1", documentType: "csd", fileName: "CSD Registration Report.pdf" })] } });
    expect(state.blockers).not.toContain("Tax Compliance document not found");
    expect(state.complianceStatus).toBe("VALID");
  });

  test("compliance recalculation updates match score", () => {
    const [blocked] = matchContractorsForOpportunity({ deal, contractors: [{ ...baseContractor, id: "c1", documents: [] }] });
    const [valid] = matchContractorsForOpportunity({ deal, contractors: [{ ...baseContractor, id: "c1", documents: [doc({}), doc({ id: "csd-1", documentType: "csd", fileName: "CSD Registration Report.pdf" })] }] });
    expect(valid.matchScore).toBeGreaterThan(blocked.matchScore);
  });

  test("compliance completion moves workflow forward", () => {
    expect(deriveOpportunityPhase({ deal, contractor: { ...baseContractor, documents: [doc({}), doc({ id: "csd-1", documentType: "csd", fileName: "CSD Registration Report.pdf" })] } })).toBe("DOCUMENT_PREPARATION");
  });

  test("cross-workspace document is rejected", () => {
    expect(statusFor({ ...baseContractor, documents: [doc({ workspaceId: "workspace-b" })] }, "tax")).toMatchObject({ status: "INVALID" });
  });

  test("no mock data is used", () => {
    const matches = matchContractorsForOpportunity({ deal, contractors: [{ ...baseContractor, id: "mock", mockContractor: true }, { ...baseContractor, id: "c1", documents: [] }] });
    expect(matches).toHaveLength(1);
  });

  test("UI model exposes exact action and reason", () => {
    const [match] = matchContractorsForOpportunity({ deal, contractors: [{ ...baseContractor, id: "c1", documents: [doc({ verified: false, status: "uploaded" })] }] });
    expect(match.complianceDetails.find((detail) => detail.key === "tax")).toMatchObject({ status: "UNVERIFIED", requiredAction: "Verify document", reason: "Tax Compliance document uploaded but not verified" });
  });
});

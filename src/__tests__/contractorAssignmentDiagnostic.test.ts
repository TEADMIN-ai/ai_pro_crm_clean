import {
  PRODUCTION_READ_ONLY_CONFIRMATION,
  buildContractorAssignmentDiagnostic,
  type DiagnosticReader,
  type DiagnosticDocumentSnapshot,
} from "@/server/diagnostics/contractorAssignmentDiagnostic";

type Store = Record<string, Record<string, unknown>>;

function doc(path: string, data: Record<string, unknown> | null): DiagnosticDocumentSnapshot {
  const id = path.split("/").at(-1) ?? path;
  return { exists: Boolean(data), id, path, data };
}

function reader(store: Store) {
  const reads: string[] = [];
  const writes: string[] = [];
  const diagnosticReader: DiagnosticReader = {
    async getDocument(path: string) {
      reads.push(path);
      return doc(path, store[path] ?? null);
    },
    async listSubcollection(path: string) {
      reads.push(`${path}/*`);
      const prefix = `${path}/`;
      return Object.entries(store)
        .filter(([key]) => key.startsWith(prefix) && key.slice(prefix.length).split("/").length === 1)
        .map(([key, value]) => doc(key, value));
    },
  };
  return { diagnosticReader, reads, writes };
}

const deal = {
  id: "deal-1",
  title: "RFQ",
  workspaceId: "workspace-a",
  opportunityExecution: { requirementsReviewed: true, requirements: { reviewed: true, taxRequirement: true, csdRequirement: true } },
  tenderAnalysis: { requiredCertificates: ["Tax compliance", "CSD"], location: "Cape Town" },
  documents: [{ documentType: "rfq", fileName: "rfq.pdf", fileUrl: "gs://rfq", verified: true }],
};

const readyContractor = {
  id: "c1",
  contractorId: "c1",
  companyName: "Torque Empire PTY Ltd",
  legalName: "Torque Empire PTY Ltd",
  workspaceId: "workspace-a",
  status: "active",
  csdNumber: "MAAA1234567",
  decisionEvaluatedAt: "2026-07-20T00:00:00.000Z",
  decisionLogicVersion: "contractor-repository-decision-v1",
  sarsTcsSummary: {
    id: "sars-1",
    contractorId: "c1",
    workspaceId: "workspace-a",
    pinStatus: "ACTIVE",
    verificationStatus: "VERIFIED_COMPLIANT",
    verifiedAt: "2026-07-20T00:00:00.000Z",
    recheckDueAt: "2026-08-20T00:00:00.000Z",
    taxpayerNameMatch: "MATCH",
    taxReferenceMatch: "MATCH",
    registrationNumberMatch: "NOT_APPLICABLE",
    contractorIdentityMatch: "MATCH",
    verificationEvidenceHash: "hash",
  },
};

function verifiedDoc(contractorId: string, documentType: string, extra: Record<string, unknown> = {}) {
  return {
    contractorId,
    documentType,
    fileUrl: `gs://${contractorId}/${documentType}.pdf`,
    verified: true,
    verifiedAt: "2026-07-20T00:00:00.000Z",
    status: "verified",
    ...extra,
  };
}

function readyStore(overrides: Store = {}): Store {
  return {
    "deals/deal-1": deal,
    "contractors/c1": readyContractor,
    "contractors/c1/documents/cipc": verifiedDoc("c1", "cipc"),
    "contractors/c1/documents/bbbee": verifiedDoc("c1", "bbbee"),
    "contractors/c1/documents/taxClearance": verifiedDoc("c1", "taxClearance"),
    "contractors/c1/documents/coida": verifiedDoc("c1", "coida"),
    "contractors/c1/documents/bankConfirmation": verifiedDoc("c1", "bankConfirmation"),
    "opportunityExecutionWorkspaces/deal-1": {},
    "submissionReviews/deal-1": {},
    ...overrides,
  };
}

async function report(store: Store) {
  const harness = reader(store);
  const result = await buildContractorAssignmentDiagnostic(
    {
      contractorId: "c1",
      dealId: "deal-1",
      workspaceId: "workspace-a",
      production: true,
      productionReadOnlyConfirmation: PRODUCTION_READ_ONLY_CONFIRMATION,
      evaluatedAt: "2026-07-21T00:00:00.000Z",
    },
    harness.diagnosticReader,
  );
  return { result, harness };
}

describe("contractor assignment diagnostic", () => {
  test("blocks unresolved identity", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, companyName: "", legalName: "" } }));
    expect(result.contractorIdentity.identityResolved).toBe(false);
    expect(result.assignmentAuthorityPreview.status).toBe("BLOCKED");
    expect(result.assignmentAuthorityPreview.blockers.join(" ")).toMatch(/identity/i);
  });

  test("blocks wrong workspace", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, workspaceId: "workspace-b" } }));
    expect(result.workspace.matches).toBe(false);
    expect(result.assignmentAuthorityPreview.blockers).toContain("Contractor workspace does not match deal workspace");
  });

  test("blocks archived contractor", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, archived: true } }));
    expect(result.contractorIdentity.archived).toBe(true);
    expect(result.assignmentAuthorityPreview.blockers).toContain("Contractor is archived and cannot receive new assignments.");
  });

  test("blocks stale readiness decision", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, decisionLogicVersion: "old" } }));
    expect(result.repositoryReadiness.stale).toBe(true);
    expect(result.assignmentAuthorityPreview.status).toBe("BLOCKED");
  });

  test("blocks missing required documents", async () => {
    const store = readyStore();
    delete store["contractors/c1/documents/taxClearance"];
    const { result } = await report(store);
    expect(result.requiredEvidence.find((item) => item.requiredKey === "taxClearance")?.found).toBe(false);
    expect(result.assignmentAuthorityPreview.status).toBe("BLOCKED");
  });

  test("blocks expired required documents", async () => {
    const { result } = await report(readyStore({
      "contractors/c1/documents/taxClearance": verifiedDoc("c1", "taxClearance", { expiresAt: "2026-07-01T00:00:00.000Z", status: "expired" }),
    }));
    expect(result.requiredEvidence.find((item) => item.requiredKey === "taxClearance")?.currency).toBe("expired");
    expect(result.assignmentAuthorityPreview.status).toBe("BLOCKED");
  });

  test("blocks missing CSD", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, csdNumber: "" } }));
    expect(result.csdAndSars.csdEvidenceStatus).not.toBe("VALID");
    expect(result.csdAndSars.blockers.join(" ")).toMatch(/CSD/);
  });

  test("blocks invalid or missing SARS evidence", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, sarsTcsSummary: { verificationStatus: "NOT_STARTED", pinStatus: "NOT_PROVIDED" } } }));
    expect(result.csdAndSars.sarsTcsStatus).toBe("NOT_STARTED");
    expect(result.assignmentAuthorityPreview.blockers.join(" ")).toMatch(/SARS/);
  });

  test("blocks deal not in MATCHING_REQUIRED", async () => {
    const { result } = await report(readyStore({
      "deals/deal-1": { ...deal, contractorId: "c1", contractorAssignment: { contractorId: "c1", contractorName: "Torque Empire PTY Ltd", assignedAt: "2026-07-20T00:00:00.000Z", assignedBy: "staff-1", assignmentStatus: "assigned", executionWorkspaceId: "exec-deal-1" }, opportunityExecution: { currentPhase: "COMPLIANCE_REVIEW", requirements: { reviewed: true, taxRequirement: true } } },
    }));
    expect(result.opportunitySpecificAssignmentDecision.phaseIsMatchingRequired).toBe(false);
    expect(result.assignmentAuthorityPreview.blockers.join(" ")).toMatch(/not MATCHING_REQUIRED/);
  });

  test("detects UI allowed while server authority blocks", async () => {
    const { result } = await report(readyStore({
      "contractors/c1": { ...readyContractor, decisionLogicVersion: "old", taxValid: true, csdValid: true },
    }));
    expect(result.opportunitySpecificAssignmentDecision.uiAssignmentAllowedDecision).toBe(true);
    expect(result.assignmentAuthorityPreview.status).toBe("BLOCKED");
    expect(result.assignmentAuthorityPreview.warnings.join(" ")).toMatch(/UI\/current match calculation allows/);
  });

  test("allows only when canonical readiness authority is allowed", async () => {
    const { result } = await report(readyStore({ "contractors/c1": { ...readyContractor, taxValid: true, csdValid: true } }));
    expect(result.repositoryReadiness.assignmentAllowed).toBe(true);
    expect(result.assignmentAuthorityPreview.status).toBe("ALLOWED");
  });

  test("makes no Firestore writes and performs only bounded reads", async () => {
    const { result, harness } = await report(readyStore());
    expect(harness.writes).toEqual([]);
    expect(result.readPaths).toEqual(expect.arrayContaining([
      "deals/deal-1",
      "contractors/c1",
      "contractors/c1/documents/*",
      "contractors/c1/sarsTcs/*",
      "opportunityExecutionWorkspaces/deal-1",
      "submissionReviews/deal-1",
    ]));
    expect(result.readPaths.some((path) => path === "contractors/*" || path === "deals/*")).toBe(false);
  });
});

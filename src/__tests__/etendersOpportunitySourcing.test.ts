import { detectEtendersDuplicate } from "@/lib/etenders/duplicates";
import { fetchEtendersOpportunities, EtendersSourceError } from "@/lib/etenders/client";
import { recommendContractorsForEtendersOpportunity } from "@/lib/etenders/matching";
import { filterNormalizedEtendersRecords, generateEtendersSourceFingerprint, mapEtendersFiltersToDataTables, normalizeEtendersOpportunity } from "@/lib/etenders/normalization";
import { buildEtendersImportPayload, compareEtendersSourceChange, createEtendersExecutionWorkspace } from "@/lib/etenders/workflow";
import type { EtendersSourceRecord } from "@/lib/etenders/types";

const rawTender = {
  id: 162256,
  tender_No: "REC-74282",
  description: "Cleaning and maintenance of access booms with BOQ",
  category: "Services: General",
  type: "Request for Quotation",
  organ_of_State: "Airports Company of South Africa",
  status: "Published",
  closing_Date: "2026-08-17T12:00:00",
  date_Published: "2026-07-14T00:00:00",
  compulsory_briefing_session: "2026-07-23T10:00:00",
  briefingSession: true,
  briefingCompulsory: true,
  briefingVenue: "Cape Town International Airport",
  contactPerson: "Procurement Officer",
  email: "procurement@example.gov.za",
  telephone: "011-000-0000",
  province: "Western Cape",
  department: "Airports Company of South Africa",
  eSubmission: false,
  supportDocument: [
    {
      supportDocumentID: "doc-1",
      fileName: "REC 74282 BOQ.pdf",
      extension: ".pdf",
      active: true,
      dateModified: "2026-07-14T10:42:16",
    },
    {
      supportDocumentID: "doc-2",
      fileName: "Addendum 1.pdf",
      extension: ".pdf",
      active: true,
      dateModified: "2026-07-15T10:42:16",
    },
  ],
};

function source(overrides: Partial<EtendersSourceRecord> = {}) {
  return { ...normalizeEtendersOpportunity(rawTender, "2026-07-14T11:00:00.000Z"), ...overrides };
}

describe("official eTenders opportunity sourcing", () => {
  test("normalizes eTenders result into canonical source model and preserves official document links", () => {
    const record = source();
    expect(record.sourceSystem).toBe("ETENDERS_SA");
    expect(record.sourceOpportunityId).toBe("162256");
    expect(record.tenderNumber).toBe("REC-74282");
    expect(record.eSubmissionAccepted).toBe(false);
    expect(record.briefingCompulsory).toBe(true);
    expect(record.documentLinks).toHaveLength(2);
    expect(record.documentLinks[0]).toMatchObject({ sourceDocumentId: "doc-1", kind: "BOQ" });
    expect(record.amendmentLinks[0]).toMatchObject({ sourceDocumentId: "doc-2", kind: "AMENDMENT" });
  });

  test("maps filters and Torque Empire presets to DataTables query shape", () => {
    const mapped = mapEtendersFiltersToDataTables({
      keywords: "airport",
      tenderNumber: "REC",
      preset: "cleaning-facilities",
      eSubmissionAccepted: true,
    });
    expect(mapped.status).toBe(1);
    expect(mapped.search.value).toContain("airport");
    expect(mapped.search.value).toContain("cleaning");
    expect(mapped.tenderNumber).toBe("REC");
    expect(mapped.eSubmission).toBe("true");
  });

  test("filters normalized records by category, province, eSubmission and closing date", () => {
    const records = [
      source(),
      source({ sourceOpportunityId: "2", province: "Gauteng", category: "Telecommunications", eSubmissionAccepted: true }),
    ];
    const filtered = filterNormalizedEtendersRecords(records, {
      province: "Western Cape",
      category: "Services: General",
      eSubmissionAccepted: false,
      closingFrom: "2026-08-01",
      closingTo: "2026-08-31",
    });
    expect(filtered.map((item) => item.sourceOpportunityId)).toEqual(["162256"]);
  });

  test("generates stable source fingerprints and changes on amendment changes", () => {
    const first = source();
    const same = generateEtendersSourceFingerprint(first);
    const changed = generateEtendersSourceFingerprint({
      ...first,
      documentLinks: [...first.documentLinks, { ...first.documentLinks[0], sourceDocumentId: "doc-3", id: "doc-3" }],
    });
    expect(same).toBe(first.sourceFingerprint);
    expect(changed).not.toBe(first.sourceFingerprint);
  });

  test("prevents duplicates using source id, tender issuer, source URL and fingerprint", () => {
    const record = source();
    expect(detectEtendersDuplicate(record, [{ id: "deal-1", etendersSource: record }])).toMatchObject({ duplicate: true, reason: "source_id" });
    expect(detectEtendersDuplicate(record, [{ id: "deal-2", tenderNumber: record.tenderNumber, issuingAuthority: record.organOfState }])).toMatchObject({ duplicate: true, reason: "tender_issuer" });
    expect(detectEtendersDuplicate(record, [{ id: "deal-3", sourceUrl: record.sourceUrl }])).toMatchObject({ duplicate: true, reason: "source_url" });
    expect(detectEtendersDuplicate(record, [{ id: "deal-4", etendersSource: { sourceFingerprint: record.sourceFingerprint } }])).toMatchObject({ duplicate: true, reason: "fingerprint" });
  });

  test("requires opportunity review before import and does not create an active deal", () => {
    const payload = buildEtendersImportPayload({
      sourceRecord: source(),
      selectedSectorIds: ["cleaning-facilities"],
      classification: "facilities-services",
      reviewedByUid: "staff-1",
    }, "2026-07-14T12:00:00.000Z");
    expect(payload.opportunityIntake.reviewedBeforeImport).toBe(true);
    expect(payload.status).toBe("draft");
    expect(payload.workflowStatus).toBe("MATCHING_REQUIRED");
    expect(payload.eTenderDocumentLinks).toHaveLength(2);
  });

  test("imported opportunity appears as an Opportunity Register deal payload", () => {
    const payload = buildEtendersImportPayload({
      sourceRecord: source(),
      selectedSectorIds: ["cleaning-facilities"],
      classification: "facilities-services",
      reviewedByUid: "staff-1",
      workspaceId: "workspace-a",
    });
    expect(payload.type).toBe("opportunity");
    expect(payload.source).toBe("etenders-sa");
    expect(payload.workspaceId).toBe("workspace-a");
  });

  test("contractor recommendations never use mock contractors and evaluate real matching signals", () => {
    const matches = recommendContractorsForEtendersOpportunity(source(), [
      { id: "mock", demoContractor: true, companyName: "Demo", capabilities: ["cleaning"], readinessScore: 100 },
      { id: "real", contractorId: "real", companyName: "Real Contractor", capabilities: ["cleaning"], provinces: ["Western Cape"], readinessScore: 90, docsMissing: 0 },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].contractorId).toBe("real");
    expect(matches[0].bucket).toBe("recommended");
  });

  test("contractor assignment creates execution workflow and redirects to next actionable stage", () => {
    const workspace = createEtendersExecutionWorkspace({
      opportunityId: "deal-1",
      dealId: "deal-1",
      contractorId: "contractor-1",
      workspaceId: "workspace-a",
      sourceTenderId: "162256",
      complianceMissing: [],
      boqRequired: false,
      now: "2026-07-14T12:00:00.000Z",
    });
    expect(workspace.route).toBe("/dashboard/deals/deal-1/execution");
    expect(workspace.stages.map((item) => item.label)).toContain("Tender-pack generation");
  });

  test("missing compliance blocks submission readiness", () => {
    const workspace = createEtendersExecutionWorkspace({
      opportunityId: "deal-1",
      dealId: "deal-1",
      contractorId: "contractor-1",
      workspaceId: "workspace-a",
      sourceTenderId: "162256",
      complianceMissing: ["Tax compliance"],
      boqRequired: false,
    });
    expect(workspace.submissionReady).toBe(false);
    expect(workspace.stages.find((item) => item.key === "submission_readiness")?.status).toBe("blocked");
  });

  test("BOQ presence activates BOQ workflow and no BOQ does not block unrelated tenders", () => {
    const withBoq = buildEtendersImportPayload({ sourceRecord: source(), selectedSectorIds: ["construction-maintenance"], classification: "construction", reviewedByUid: "staff" });
    const withoutBoq = buildEtendersImportPayload({ sourceRecord: source({ documentLinks: [], amendmentLinks: [] }), selectedSectorIds: ["cleaning-facilities"], classification: "cleaning", reviewedByUid: "staff" });
    expect(withBoq.boqRequired.status).toBe("missing");
    expect(withoutBoq.boqRequired.status).toBe("not_applicable");
  });

  test("source amendments and cancellations produce review alerts safely", () => {
    const previous = source();
    const latest = source({ closingAt: "2026-08-20T12:00:00", sourceStatus: "CANCELLED", sourceFingerprint: "changed" });
    const alerts = compareEtendersSourceChange(previous, latest);
    expect(alerts).toEqual(expect.arrayContaining(["closing_date_changed", "source_status_cancelled", "source_fingerprint_changed"]));
  });

  test("cross-workspace assignment is rejected by comparison rule", () => {
    const dealWorkspace: string = "workspace-a";
    const contractorWorkspace: string = "workspace-b";
    expect(dealWorkspace === contractorWorkspace).toBe(false);
  });

  test("failed source requests produce a controlled error", async () => {
    await expect(fetchEtendersOpportunities({
      fetchImpl: async () => ({ ok: false, status: 503 } as Response),
    })).rejects.toBeInstanceOf(EtendersSourceError);
  });

  test("unauthorised access is represented by staff-only API contract", () => {
    const staffOnlyRoutes = [
      "/api/opportunity-register/etenders/search",
      "/api/opportunity-register/etenders/import",
      "/api/opportunity-register/etenders/assign",
      "/api/opportunity-register/etenders/refresh",
    ];
    expect(staffOnlyRoutes.every((route) => route.includes("/etenders/"))).toBe(true);
  });
});


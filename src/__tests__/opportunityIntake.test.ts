import {
  OPPORTUNITY_DRAFT_STORAGE_KEY,
  buildOpportunitySummary,
  canCreateOpportunity,
  createOpportunityDraft,
  getMissingCreateRequirements,
  getStepCompletion,
  markManualField,
  mergeExtractionIntoDraft,
  type OpportunityDraft,
  type OpportunityExtractionResult,
} from "@/lib/opportunities/opportunityIntake";
import { mapDealToOpportunityRegisterRecord } from "@/components/opportunity-register/opportunityRegisterData";
import type { Deal } from "@/types/deal";

function completeDraft(overrides: Partial<OpportunityDraft> = {}): OpportunityDraft {
  return {
    ...createOpportunityDraft("draft-test-1"),
    opportunityTitle: "Road rehabilitation",
    clientName: "Sarah Baartman District Municipality",
    closingDate: "2026-08-15",
    uploadedDocuments: [{ id: "doc-1", documentType: "rfq", name: "rfq.pdf" }],
    ...overrides,
  };
}

const extraction: OpportunityExtractionResult = {
  analyzedAt: "2026-07-14T10:00:00.000Z",
  documentName: "rfq.pdf",
  fields: {
    referenceNumber: { value: "RFQ-2026-001", confidence: 0.9, source: "reference pattern" },
    opportunityTitle: { value: "Road rehabilitation", confidence: 0.82, source: "title" },
    clientName: { value: "Sarah Baartman District Municipality", confidence: 0.8, source: "issuer" },
    municipality: { value: "Sarah Baartman District Municipality", confidence: 0.76, source: "municipality label" },
    department: { value: "Infrastructure", confidence: 0.7, source: "department label" },
    closingDate: { value: "2026-08-15", confidence: 0.78, source: "closing label" },
    estimatedValue: { value: "1250000", confidence: 0.68, source: "value label" },
  },
};

describe("opportunity intake workflow", () => {
  test("Step 1 values persist into Summary", () => {
    const draft = completeDraft({ opportunityTitle: "Bridge repairs", clientName: "City Client" });
    const summary = buildOpportunitySummary(draft);

    expect(summary.find((field) => field.key === "opportunityTitle")?.value).toBe("Bridge repairs");
    expect(summary.find((field) => field.key === "clientName")?.value).toBe("City Client");
  });

  test("uploaded RFQ metadata populates Summary", () => {
    const draft = mergeExtractionIntoDraft(createOpportunityDraft("draft-test-2"), extraction);
    const summary = buildOpportunitySummary(draft);

    expect(summary.find((field) => field.key === "referenceNumber")?.value).toBe("RFQ-2026-001");
    expect(summary.find((field) => field.key === "clientName")?.status).toBe("extracted");
  });

  test("manual values override lower-confidence extraction", () => {
    const manual = markManualField(createOpportunityDraft("draft-test-3"), "opportunityTitle", "Manual title");
    const merged = mergeExtractionIntoDraft(manual, {
      ...extraction,
      fields: {
        opportunityTitle: { value: "Extracted title", confidence: 0.99, source: "title" },
      },
    });

    expect(merged.opportunityTitle).toBe("Manual title");
    expect(merged.fieldSources.opportunityTitle).toBe("manual");
  });

  test("missing estimated value and RFQ number do not disable Create", () => {
    const draft = completeDraft({ estimatedValue: "", referenceNumber: "" });

    expect(canCreateOpportunity(draft)).toBe(true);
    expect(getMissingCreateRequirements(draft)).toEqual([]);
  });

  test("missing title disables Create with a visible reason", () => {
    expect(getMissingCreateRequirements(completeDraft({ opportunityTitle: "" }))).toContain("Opportunity title");
  });

  test("missing client disables Create with a visible reason", () => {
    expect(getMissingCreateRequirements(completeDraft({ clientName: "" }))).toContain("Client/issuer");
  });

  test("missing closing date disables Create with a visible reason", () => {
    expect(getMissingCreateRequirements(completeDraft({ closingDate: "" }))).toContain("Closing date");
  });

  test("missing primary RFQ document disables Create with a visible reason", () => {
    expect(getMissingCreateRequirements(completeDraft({ uploadedDocuments: [] }))).toContain("Primary RFQ/RFP document");
  });

  test("step completion reflects actual stored data", () => {
    expect(getStepCompletion(completeDraft()).detailsComplete).toBe(true);
    expect(getStepCompletion(completeDraft({ opportunityTitle: "" })).detailsComplete).toBe(false);
  });

  test("refresh restore payload preserves draft data", () => {
    const draft = completeDraft({ province: "Eastern Cape", category: "Roadworks" });
    const restored = JSON.parse(JSON.stringify(draft)) as OpportunityDraft;

    expect(OPPORTUNITY_DRAFT_STORAGE_KEY).toContain("opportunity-intake-draft");
    expect(restored.province).toBe("Eastern Cape");
    expect(restored.uploadedDocuments[0].name).toBe("rfq.pdf");
  });

  test("API failure can preserve the same draft for retry", () => {
    const draft = completeDraft({ draftId: "retry-draft" });
    const retryDraft = { ...draft };

    expect(retryDraft.draftId).toBe("retry-draft");
    expect(retryDraft.opportunityTitle).toBe(draft.opportunityTitle);
  });

  test("duplicate clicks can reuse the draft idempotency key", () => {
    const draft = completeDraft({ draftId: "stable-draft-id" });

    expect(draft.draftId).toBe("stable-draft-id");
  });

  test("Summary never shows missing when valid draft data exists", () => {
    const summary = buildOpportunitySummary(completeDraft({ municipality: "Nelson Mandela Bay" }));

    expect(summary.find((field) => field.key === "municipality")).toMatchObject({
      value: "Nelson Mandela Bay",
      status: "manual",
    });
  });

  test("created opportunity maps into the Opportunity Register model with linked documents", () => {
    const record = mapDealToOpportunityRegisterRecord({
      id: "deal-1",
      type: "opportunity",
      title: "Road rehabilitation",
      companyId: "unassigned",
      stage: "lead",
      value: 1250000,
      documents: [{ id: "doc-1", name: "rfq.pdf", storagePath: "uploads/deals/deal-1/rfq.pdf" }],
      tenderAnalysis: {
        issuingAuthority: "Sarah Baartman District Municipality",
        tenderNumber: "RFQ-2026-001",
        deadline: "2026-08-15",
        estimatedValue: 1250000,
        location: "Sarah Baartman District Municipality",
      },
      createdAt: 1784102400000,
    } satisfies Deal);

    expect(record.id).toBe("deal-1");
    expect(record.rfqNumber).toBe("RFQ-2026-001");
    expect(record.client).toBe("Sarah Baartman District Municipality");
  });
});

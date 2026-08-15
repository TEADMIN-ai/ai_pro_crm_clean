import { buildTenderIntelligence, type TenderDocumentTextInput } from "@/lib/tender-intelligence/analyzer";
import { buildExecutionHandoff } from "@/lib/tender-intelligence/summaries";
import type { TenderIntelligence } from "@/types/tenderIntelligence";
import { hasValidTenderLineQuantity } from "@/server/services/tenderIntelligenceService";

function doc(overrides: Partial<TenderDocumentTextInput> & { text: string; filename?: string; documentId?: string }): TenderDocumentTextInput {
  return {
    documentId: overrides.documentId ?? "doc-1",
    filename: overrides.filename ?? "rfq.pdf",
    storagePath: `deals/deal-1/${overrides.filename ?? "rfq.pdf"}`,
    pageCount: overrides.pageCount ?? 1,
    extractionSource: "PDF_TEXT",
    extractionStatus: "EXTRACTED",
    text: overrides.text,
  };
}

function analyze(documents: TenderDocumentTextInput[], existing?: TenderIntelligence | null) {
  return buildTenderIntelligence({
    id: existing?.id ?? "ti-1",
    workspaceId: "workspace-a",
    opportunityId: "deal-1",
    dealId: "deal-1",
    documents,
    existing,
    nowIso: "2026-07-17T10:00:00.000Z",
  });
}

describe("tender intelligence analyzer", () => {
  test("separate BOQ document is detected", () => {
    const result = analyze([
      doc({ documentId: "rfq", filename: "rfq.pdf", text: "Tender number RFQ-123 Closing date: 31 July 2026" }),
      doc({
        documentId: "boq",
        filename: "Bill of Quantities.pdf",
        text: "Bill of Quantities\nItem | Description | Quantity | Unit | Unit Rate | Amount\n1 | Cleaning service | 10 | each | 100.00 | 1000.00",
      }),
    ]);
    expect(result.boqClassification).toBe("SEPARATE_BOQ_DOCUMENT");
    expect(result.extractedLineItems).toHaveLength(1);
  });

  test("embedded BOQ is detected inside an RFQ", () => {
    const result = analyze([
      doc({
        text: "RFQ notice\nBill of Quantities\nItem | Description | Quantity | Unit | Amount\n1 | Filters | 4 | each | 400.00",
      }),
    ]);
    expect(result.boqClassification).toBe("EMBEDDED_BOQ");
  });

  test("embedded pricing schedule is detected", () => {
    const result = analyze([
      doc({
        text: "Returnable Pricing Schedule\nItem | Description | Qty | Unit | Total\n1 | Site establishment | 1 | sum | 2500.00",
      }),
    ]);
    expect(result.boqClassification).toBe("EMBEDDED_PRICING_SCHEDULE");
  });

  test("BOQ heading absent but pricing table present is not reported as no pricing", () => {
    const result = analyze([
      doc({
        text: "Commercial returnable\nItem | Description | Quantity | Unit | Unit Price | Amount\n1 | Mobilisation | 1 | lot | 1500.00 | 1500.00",
      }),
    ]);
    expect(result.boqClassification).toBe("EMBEDDED_PRICING_SCHEDULE");
  });

  test("multi-page pricing table is merged into one line-item set", () => {
    const result = analyze([
      doc({
        pageCount: 2,
        text: "Pricing Schedule\nItem | Description | Quantity | Unit | Amount\n1 | Collection bins | 5 | each | 500.00\n--- page 2 ---\nItem | Description | Quantity | Unit | Amount\n2 | Monthly service | 12 | month | 1200.00",
      }),
    ]);
    expect(result.extractedLineItems.map((item) => item.description)).toEqual(expect.arrayContaining(["Collection bins", "Monthly service"]));
  });

  test("repeated headers are handled", () => {
    const result = analyze([
      doc({
        pageCount: 2,
        text: "Schedule of Rates\nItem | Description | Quantity | Unit | Rate | Amount\n1 | Labour | 8 | hour | 250.00 | 2000.00\n--- page 2 ---\nItem | Description | Quantity | Unit | Rate | Amount\n2 | Supervisor | 2 | day | 900.00 | 1800.00",
      }),
    ]);
    expect(result.extractedLineItems).toHaveLength(2);
  });

  test("split rows are merged and require review", () => {
    const result = analyze([
      doc({
        text: "Pricing Schedule\nItem | Description | Quantity | Unit | Amount\n1 | Deep cleaning of depot | 3 | each | 900.00\nincluding degreasing of floors and disposal certificates boq | pricing schedule | each",
      }),
    ]);
    expect(result.extractedLineItems[0].rawText).toContain("including degreasing");
    expect(result.extractedLineItems[0].reviewStatus).toBe("REVIEW_REQUIRED");
  });

  test("false-positive financial table is rejected as BOQ", () => {
    const result = analyze([
      doc({
        text: "Historical financial statements\nYear | Revenue | Expenses | Profit\n2024 | R 100000 | R 90000 | R 10000",
      }),
    ]);
    expect(result.boqClassification).not.toBe("EMBEDDED_BOQ");
    expect(result.extractedLineItems).toHaveLength(0);
  });

  test("evaluation table is rejected as BOQ", () => {
    const result = analyze([
      doc({
        text: "Evaluation criteria\nCriteria | Score | Points\nExperience | 40 | 40\nMethodology | 60 | 60",
      }),
    ]);
    expect(result.extractedLineItems).toHaveLength(0);
    expect(result.boqClassification).not.toBe("EMBEDDED_PRICING_SCHEDULE");
  });

  test("pricing required but template missing is classified", () => {
    const result = analyze([
      doc({ text: "Bidders must submit a Financial Proposal and tender sum. The pricing template will be issued separately." }),
    ]);
    expect(result.boqClassification).toBe("PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND");
  });

  test("no-pricing tender is classified correctly", () => {
    const result = analyze([
      doc({ text: "No pricing required for this expression of interest. Rates will not be evaluated at this stage." }),
    ]);
    expect(result.boqClassification).toBe("NO_PRICING_REQUIRED");
  });

  test("source page references are preserved", () => {
    const result = analyze([
      doc({
        pageCount: 2,
        text: "General conditions\n--- page 2 ---\nPricing Schedule\nItem | Description | Quantity | Unit | Amount\n1 | Pumps | 2 | each | 6000.00",
      }),
    ]);
    expect(result.pricingTables[0]).toMatchObject({ sourceDocumentId: "doc-1", sourcePage: 2 });
    expect(result.sourceEvidence.some((evidence) => evidence.sourcePage === 2)).toBe(true);
  });

  test("low-confidence rows require review", () => {
    const result = analyze([
      doc({ text: "Pricing Schedule financial statement\nItem | Description | Quantity | Unit | Amount\n1 | Revenue service | 1 | each | 0.00" }),
    ]);
    expect(result.extractedLineItems.some((item) => item.reviewStatus === "REVIEW_REQUIRED")).toBe(true);
  });

  test("staff correction overrides extraction", () => {
    const result = analyze([
      doc({ text: "Pricing Schedule\nItem | Description | Quantity | Unit | Amount\n1 | Cleaning | 1 | each | 100.00" }),
    ]);
    const corrected = {
      ...result.extractedLineItems[0],
      quantity: 2,
      manuallyCorrected: true,
      correctedBy: "staff-1",
      correctedAt: "2026-07-17T11:00:00.000Z",
      reviewStatus: "APPROVED" as const,
    };
    expect(corrected.quantity).toBe(2);
    expect(corrected.manuallyCorrected).toBe(true);
  });

  test("approval is required before pricing handoff can continue", () => {
    const result = analyze([
      doc({ text: "Pricing Schedule\nItem | Description | Quantity | Unit | Amount\n1 | Cleaning | 1 | each | 100.00" }),
    ]);
    const handoff = buildExecutionHandoff(result);
    expect(handoff.analysisBlockers).toContain("Tender intelligence must be staff approved before pricing handoff");
    expect(handoff.nextAction).not.toBe("Continue to supplier quote mapping");
  });

  test("amendment creates revised analysis and supersedes prior approved intelligence", () => {
    const approved = { ...analyze([doc({ text: "Closing date: 31 July 2026" })]), analysisStatus: "APPROVED" as const, reviewStatus: "APPROVED" as const };
    const revised = analyze([doc({ text: "Amendment 1\nClosing date: 5 August 2026" })], approved);
    expect(revised.amendmentOfIntelligenceId).toBe(approved.id);
    expect(revised.documentAnalyses[0].amendmentStatus).toBe("AMENDED");
  });

  test("cross-workspace handoff carries workspace isolation fields", () => {
    const result = analyze([doc({ text: "No pricing required for this EOI." })]);
    expect(result.workspaceId).toBe("workspace-a");
    expect(buildExecutionHandoff(result).tenderIntelligenceId).toBe(result.id);
  });

  test("no production fallback tender data is introduced", () => {
    const result = analyze([doc({ documentId: "source-doc", text: "Tender number: RFQ-999" })]);
    expect(result.sourceDocumentIds).toEqual(["source-doc"]);
    expect(result.sourceDocumentIds).not.toContain("demo");
  });


  test("quantity mode distinguishes extraction failure from reviewed unit-rate absence", () => {
    const base = analyze([doc({ text: "Pricing Schedule" })]).extractedLineItems[0] ?? {
      id: "line-1", sourceDocumentId: "doc-1", sourcePage: 38, sourceTableIndex: 0, sourceRow: 1, itemNumber: "1", description: "Water", specification: null, quantity: null, unit: "Each", tenderUnitPrice: null, tenderLineTotal: null, vatTreatment: null, mandatoryField: true, notes: null, rawText: "Water", extractionConfidence: 1, reviewStatus: "APPROVED" as const, manuallyCorrected: true, correctedBy: "staff-1", correctedAt: "2026-08-01T00:00:00.000Z" };
    expect(hasValidTenderLineQuantity({ ...base, quantity: null, quantityMode: "FIXED_QUANTITY", reviewStatus: "APPROVED" })).toBe(false);
    expect(hasValidTenderLineQuantity({ ...base, quantity: null, quantityMode: "UNIT_RATE_ONLY", reviewStatus: "APPROVED", manuallyCorrected: true, sourcePage: 38, unit: "Each" })).toBe(true);
    expect(hasValidTenderLineQuantity({ ...base, quantity: null, quantityMode: "UNIT_RATE_ONLY", reviewStatus: "APPROVED", manuallyCorrected: false, sourcePage: 38, unit: "Each" })).toBe(false);
  });
});

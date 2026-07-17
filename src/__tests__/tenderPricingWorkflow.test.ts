import {
  approveTenderPricing,
  buildPricingScheduleFillEvidence,
  buildTenderPricingHandoff,
  buildTenderPricingWorkspace,
  createTenderPricingRevision,
  lockTenderPricing,
  mapSupplierQuotesToTenderLines,
  validateTenderPricingSources,
  validateTenderPricingWorkspace,
} from "@/lib/tender-pricing";
import type { SupplierQuote } from "@/types/supplierQuote";
import type { TenderLineMapping, TenderPricingTenderLineItem } from "@/types/tenderPricing";

function line(overrides: Partial<TenderPricingTenderLineItem> = {}): TenderPricingTenderLineItem {
  return {
    id: "line-1",
    itemCode: "IC-1",
    description: "Industrial cleaner",
    quantity: 2,
    unit: "each",
    specification: "Industrial grade cleaner",
    compulsory: true,
    sourcePage: 2,
    sourceDocumentId: "pricing-doc-1",
    ...overrides,
  };
}

function quote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    id: "quote-a",
    workspaceId: "workspace-a",
    opportunityId: "opp-1",
    dealId: "deal-1",
    contractorId: "torque-empire",
    contractorName: "Torque Empire (Pty) Ltd",
    supplierId: "supplier-a",
    supplierName: "Supplier A",
    supplierRegistrationNumber: "REG-1",
    supplierContactName: "Sarah",
    supplierEmail: "supplier@example.com",
    supplierPhone: "0110000000",
    quotationNumber: "Q-001",
    quotationDate: "2026-07-01",
    validityDate: "2026-08-01",
    currency: "ZAR",
    subtotal: 100,
    vat: 15,
    total: 115,
    deliveryCost: 10,
    deliveryPeriod: "2 days",
    paymentTerms: "30 days",
    uploadedDocumentId: "doc-1",
    storagePath: "supplier-quotes/workspace-a/deal-1/quote-a/a.pdf",
    sourceFileName: "a.pdf",
    documentClassification: "SUPPLIER_QUOTE",
    extractionStatus: "EXTRACTED",
    reviewStatus: "REVIEWED",
    approvalStatus: "APPROVED",
    workflowStatus: "APPROVED",
    approvedBy: "staff-1",
    approvedAt: "2026-07-17T10:00:00.000Z",
    approvalNote: null,
    rejectionReason: null,
    clarificationRequest: null,
    lineItems: [
      {
        id: "supplier-line-1",
        tenderLineItemId: null,
        boqLineItemId: null,
        pricingScheduleLineItemId: null,
        sourceDescription: "Industrial cleaner IC-1",
        normalisedDescription: "industrial cleaner ic 1",
        supplierSku: "IC-1",
        quantity: 2,
        unit: "each",
        unitPrice: 50,
        lineTotal: 100,
        vatTreatment: "EXCLUSIVE",
        deliveryAllocation: 0,
        confidence: 0.95,
        sourcePage: 1,
        sourceText: "Industrial cleaner IC-1 2 each R50 R100",
        manualOverride: false,
        approved: true,
        approvedBy: "staff-1",
        approvedAt: "2026-07-17T10:00:00.000Z",
      },
    ],
    extraction: {
      supplierName: { value: "Supplier A", confidence: 1, manual: { overridden: false } },
      quotationNumber: { value: "Q-001", confidence: 1, manual: { overridden: false } },
      quotationDate: { value: "2026-07-01", confidence: 1, manual: { overridden: false } },
      validityDate: { value: "2026-08-01", confidence: 1, manual: { overridden: false } },
      vat: { value: 15, confidence: 1, manual: { overridden: false } },
      deliveryCost: { value: 10, confidence: 1, manual: { overridden: false } },
      deliveryPeriod: { value: "2 days", confidence: 1, manual: { overridden: false } },
      paymentTerms: { value: "30 days", confidence: 1, manual: { overridden: false } },
      exclusions: { value: [], confidence: 1, manual: { overridden: false } },
      notes: { value: [], confidence: 1, manual: { overridden: false } },
      rawTextPreview: null,
      pageCount: 1,
    },
    duplicateKey: "duplicate-a",
    supersedesQuoteId: null,
    createdBy: "staff-1",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
    ...overrides,
  };
}

function build(overrides: Parameters<typeof buildTenderPricingWorkspace>[0] extends infer T ? Partial<T> : never = {}) {
  return buildTenderPricingWorkspace({
    workspaceId: "workspace-a",
    opportunityId: "opp-1",
    dealId: "deal-1",
    contractorId: "torque-empire",
    contractorName: "Torque Empire (Pty) Ltd",
    tenderIntelligenceApproved: true,
    tenderLineItems: [line()],
    sourcePricingDocumentRequired: true,
    sourcePricingDocumentId: "pricing-doc-1",
    sourcePricingDocumentPath: "tenders/deal-1/pricing.pdf",
    supplierQuotes: [quote()],
    createdBy: "staff-1",
    now: "2026-07-17T10:00:00.000Z",
    ...overrides,
  });
}

function approvedForFill() {
  const staff = approveTenderPricing(build(), { uid: "staff-1", role: "staff" }, "2026-07-17T11:00:00.000Z");
  return approveTenderPricing(staff, { uid: "manager-1", role: "manager" }, "2026-07-17T12:00:00.000Z");
}

describe("tender pricing workflow", () => {
  test("approved supplier quote maps to tender item", () => {
    const mappings = mapSupplierQuotesToTenderLines({ tenderLineItems: [line()], supplierQuotes: [quote()] });
    expect(mappings[0]).toMatchObject({ tenderLineItemId: "line-1", supplierQuoteId: "quote-a" });
  });

  test("Torque Empire remains the bidder", () => {
    const workspace = build();
    expect(workspace.contractorName).toBe("Torque Empire (Pty) Ltd");
  });

  test("supplier is not treated as contractor", () => {
    const workspace = build({ supplierQuotes: [quote({ supplierName: "External Supplier", supplierId: "external" })] });
    expect(workspace.contractorId).not.toBe(workspace.approvedSupplierQuoteIds[0]);
  });

  test("two quotes are compared and lowest price is not automatically selected", () => {
    const cheapIncomplete = quote({ id: "cheap", supplierName: "Cheap Supplier", total: 50, lineItems: [{ ...quote().lineItems[0], sourceDescription: "Wrong product", normalisedDescription: "wrong product", unitPrice: 25 }] });
    const complete = quote({ id: "complete", supplierName: "Complete Supplier", total: 115 });
    const workspace = build({ supplierQuotes: [cheapIncomplete, complete] });
    expect(workspace.lineItems[0].supplierOptions[0].supplierQuoteId).toBe("complete");
  });

  test("expired quote rejected", () => {
    const blockers = validateTenderPricingSources({ workspaceId: "workspace-a", contractorId: "torque", contractorName: "Torque Empire (Pty) Ltd", tenderIntelligenceApproved: true, tenderLineItems: [line()], sourcePricingDocumentRequired: false, supplierQuotes: [quote({ validityDate: "2026-01-01" })], today: new Date("2026-07-17") });
    expect(blockers.map((item) => item.code)).toContain("QUOTE_EXPIRED");
  });

  test("rejected quote rejected", () => {
    const workspace = build({ supplierQuotes: [quote({ approvalStatus: "REJECTED", workflowStatus: "REJECTED" })] });
    expect(workspace.blockers.map((item) => item.code)).toContain("QUOTE_NOT_APPROVED");
  });

  test("low-confidence mapping requires review", () => {
    const workspace = build({ tenderLineItems: [line({ description: "Unrelated product", itemCode: "X" })] });
    expect(workspace.lineItems[0].mapping?.reviewStatus).not.toBe("AUTO_MATCHED");
  });

  test("manual mapping works", () => {
    const manual: TenderLineMapping = { id: "manual-1", tenderLineItemId: "line-1", supplierQuoteId: "quote-a", supplierLineItemId: "supplier-line-1", supplierName: "Supplier A", matchConfidence: 1, mappingReason: "Staff selected exact quote line.", quantityConversion: 1, unitConversion: 1, conversionReason: "Approved manual mapping.", supplierUnitCost: 50, priceSource: "APPROVED_SUPPLIER_QUOTE", reviewStatus: "APPROVED", reviewedBy: "staff-1", reviewedAt: "2026-07-17T10:00:00.000Z" };
    const workspace = build({ manualMappings: [manual] });
    expect(workspace.lineItems[0].mapping?.reviewStatus).toBe("APPROVED");
  });

  test("unit conversion requires approval", () => {
    const workspace = build({ supplierQuotes: [quote({ lineItems: [{ ...quote().lineItems[0], unit: "box" }] })] });
    expect(workspace.lineItems[0].riskFlags).toContain("UNSUPPORTED_CONVERSION");
  });

  test("missing item blocks validation", () => {
    const workspace = build({ tenderLineItems: [line({ description: "Missing specialist item", itemCode: "MISS" })] });
    expect(validateTenderPricingWorkspace(workspace).map((item) => item.code)).toContain("COMPULSORY_LINE_UNPRICED");
  });

  test("manual price requires reason", () => {
    const workspace = build({ tenderLineItems: [line({ description: "Manual item", itemCode: "M" })], manualPrices: [{ tenderLineItemId: "line-1", unitPrice: 100 }] });
    expect(workspace.lineItems[0].riskFlags).toContain("MANUAL_REASON_REQUIRED");
  });

  test("provisional price requires approval", () => {
    const workspace = build({ tenderLineItems: [line({ description: "Provisional item", itemCode: "P" })], manualPrices: [{ tenderLineItemId: "line-1", unitPrice: 100, reason: "Budget source", provisional: true }] });
    expect(workspace.lineItems[0].riskFlags).toContain("PROVISIONAL_APPROVAL_REQUIRED");
  });

  test("delivery allocation works", () => {
    expect(build().lineItems[0].deliveryAllocation).toBe(10);
  });

  test("overhead calculation works", () => {
    expect(build().lineItems[0].overheadAllocation).toBeGreaterThan(0);
  });

  test("risk allowance works", () => {
    expect(build().lineItems[0].riskAllowance).toBeGreaterThan(0);
  });

  test("margin calculation works", () => {
    expect(build().lineItems[0].profitMargin).toBeGreaterThan(0);
  });

  test("VAT calculation works", () => {
    expect(build().vat).toBeGreaterThan(0);
  });

  test("tender totals reconcile", () => {
    const workspace = build();
    expect(workspace.total).toBe(Number((workspace.subtotal + workspace.vat).toFixed(2)));
  });

  test("negative margin flagged", () => {
    const workspace = build({ rules: { marginPercentage: -1.2 } });
    expect(workspace.lineItems[0].riskFlags).toContain("NEGATIVE_MARGIN");
  });


  test("positive margin is not flagged as negative or low", () => {
    const workspace = build({ rules: { marginPercentage: 0.2, minimumMarginPercentage: 0.12 } });
    expect(workspace.lineItems[0].grossProfit).toBeGreaterThan(0);
    expect(workspace.lineItems[0].riskFlags).not.toContain("NEGATIVE_MARGIN");
    expect(workspace.lineItems[0].riskFlags).not.toContain("LOW_MARGIN");
  });

  test("zero margin is not treated as a loss", () => {
    const workspace = build({ rules: { marginPercentage: 0, minimumMarginPercentage: 0.12 } });
    expect(workspace.lineItems[0].grossProfit).toBe(0);
    expect(workspace.lineItems[0].riskFlags).not.toContain("NEGATIVE_MARGIN");
  });

  test("low but positive margin keeps LOW_MARGIN separate from NEGATIVE_MARGIN", () => {
    const workspace = build({ rules: { marginPercentage: 0.02, minimumMarginPercentage: 0.12 } });
    expect(workspace.lineItems[0].grossProfit).toBeGreaterThan(0);
    expect(workspace.lineItems[0].riskFlags).toContain("LOW_MARGIN");
    expect(workspace.lineItems[0].riskFlags).not.toContain("NEGATIVE_MARGIN");
  });

  test("workspace aggregate negative margin is projected from line loss", () => {
    const workspace = build({ rules: { marginPercentage: -1.2 } });
    expect(workspace.grossProfit).toBeLessThan(0);
    expect(workspace.grossMarginPercentage).toBeLessThan(0);
    expect(workspace.blockers.map((item) => item.code)).toContain("NEGATIVE_MARGIN");
  });

  test("risk flags are not duplicated", () => {
    const workspace = build({ rules: { marginPercentage: -1.2 } });
    const flags = workspace.lineItems[0].riskFlags;
    expect(flags.filter((flag) => flag === "NEGATIVE_MARGIN")).toHaveLength(1);
  });
  test("pricing approval locks revision", () => {
    const staff = approveTenderPricing(build(), { uid: "staff-1", role: "staff" });
    const manager = approveTenderPricing(staff, { uid: "manager-1", role: "manager" });
    const withEvidence = { ...manager, documentFillEvidence: buildPricingScheduleFillEvidence(manager), pricingStatus: "APPROVED" as const };
    const locked = lockTenderPricing(withEvidence, "manager-1");
    expect(locked.lockStatus).toBe("LOCKED");
  });

  test("approved change creates a new revision", () => {
    const locked = { ...build(), lockStatus: "LOCKED" as const };
    const revised = createTenderPricingRevision(locked, { changedBy: "staff-1", reason: "Supplier update", newTotal: 200, newMargin: 20 });
    expect(revised.revision).toBe(2);
    expect(revised.approvals).toHaveLength(0);
  });

  test("AI fill preserves source document", () => {
    const evidence = buildPricingScheduleFillEvidence(build());
    expect(evidence.originalPreserved).toBe(true);
  });

  test("filled document uses approved values only", () => {
    const workspace = { ...build(), pricingStatus: "APPROVED" as const };
    const evidence = buildPricingScheduleFillEvidence(workspace);
    expect(new Set(evidence.fieldMappings.map((field) => field.source))).toEqual(new Set(["approved_pricing_record"]));
  });

  test("overflow is detected", () => {
    const workspace = { ...build(), documentFillEvidence: { ...buildPricingScheduleFillEvidence(build()), validationIssues: ["overflow detected on page 2"] } };
    expect(validateTenderPricingWorkspace(workspace).map((item) => item.code)).toContain("PDF_FILL_VALIDATION_ISSUE");
  });

  test("PDF totals match pricing record", () => {
    const workspace = approvedForFill();
    const evidence = buildPricingScheduleFillEvidence(workspace);
    expect(validateTenderPricingWorkspace({ ...workspace, documentFillEvidence: evidence })).toHaveLength(0);
  });


  test("unapproved pricing values fail PDF validation", () => {
    const workspace = { ...build(), pricingStatus: "APPROVED" as const };
    const evidence = buildPricingScheduleFillEvidence(workspace);
    expect(validateTenderPricingWorkspace({ ...workspace, documentFillEvidence: evidence }).map((item) => item.code)).toContain("PDF_UNAPPROVED_PRICING_VALUE");
  });

  test("stale approval fails PDF validation", () => {
    const approved = approvedForFill();
    const stale = { ...approved, revision: approved.revision + 1 };
    const evidence = buildPricingScheduleFillEvidence(stale);
    expect(validateTenderPricingWorkspace({ ...stale, documentFillEvidence: evidence }).map((item) => item.code)).toContain("PDF_STALE_APPROVAL");
  });

  test("PDF total mismatch fails", () => {
    const workspace = approvedForFill();
    const baseEvidence = buildPricingScheduleFillEvidence(workspace);
    const evidence = {
      ...baseEvidence,
      fieldMappings: baseEvidence.fieldMappings.map((field) => field.fieldName === "grandTotal" ? { ...field, value: "1.00" } : field),
    };
    expect(validateTenderPricingWorkspace({ ...workspace, documentFillEvidence: evidence }).map((item) => item.code)).toContain("PDF_TOTAL_MISMATCH");
  });

  test("source document preservation remains enforced", () => {
    const workspace = approvedForFill();
    const evidence = { ...buildPricingScheduleFillEvidence(workspace), originalPreserved: false };
    expect(validateTenderPricingWorkspace({ ...workspace, documentFillEvidence: evidence }).map((item) => item.code)).toContain("SOURCE_DOCUMENT_MUTATED");
  });
  test("Submission Review handoff updates", () => {
    const handoff = buildTenderPricingHandoff({ ...build(), lockStatus: "LOCKED", validationStatus: "VALIDATED", pricingStatus: "LOCKED", blockers: [] });
    expect(handoff).toMatchObject({ workflowTransition: "DOCUMENT_PREPARATION", pricingApproved: true });
  });

  test("cross-workspace access rejected", () => {
    const workspace = build({ workspaceId: "workspace-a", supplierQuotes: [quote({ workspaceId: "workspace-b" })] });
    expect(workspace.blockers.map((item) => item.code)).toContain("QUOTE_WORKSPACE_MISMATCH");
  });

  test("no mock pricing data used", () => {
    const serialized = JSON.stringify(build()).toLowerCase();
    expect(serialized).not.toContain("mock");
    expect(serialized).not.toContain("demo");
  });
});

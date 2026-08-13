import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("tender pricing canonical refresh", () => {
  test("Start mapping rebuild loads canonical Tender Intelligence sources", () => {
    const pricingService = source("src/server/services/tenderPricingService.ts");
    expect(pricingService).toContain("loadCanonicalTenderPricingSources(input.dealId)");
    expect(pricingService).toContain("body: { ...input.body, id: existing?.id }, canonicalSources");
    expect(pricingService).toContain("args.tenderLineItems ?? args.canonicalSources?.tenderLineItems");
    expect(pricingService).toContain("isApprovedTenderIntelligence(canonicalIntelligence)");
  });

  test("approved intelligence handoff carries canonical source pricing document", () => {
    const intelligenceService = source("src/server/services/tenderIntelligenceService.ts");
    expect(intelligenceService).toContain("resolveTenderIntelligenceSourceDocument(next)");
    expect(intelligenceService).toContain("sourcePricingDocumentId: sourcePricingDocument.id");
    expect(intelligenceService).toContain("sourcePricingDocumentPath: sourcePricingDocument.storagePath");
  });

  test("canonical loader preserves fail-closed unapproved and missing-source paths", () => {
    const canonicalSource = source("src/server/services/tenderPricingCanonicalSources.ts");
    expect(canonicalSource).toContain("if (!isApprovedTenderIntelligence(intelligence)) return { intelligence, tenderLineItems: [], sourcePricingDocumentId: null, sourcePricingDocumentPath: null }");
    expect(canonicalSource).toContain("resolveSourceDocumentIdFromIntelligence(intelligence, approvedLines)");
    expect(canonicalSource).not.toContain("TEOS_STAGING_BOQ_TEST-RFQ-001.pdf");
  });
});

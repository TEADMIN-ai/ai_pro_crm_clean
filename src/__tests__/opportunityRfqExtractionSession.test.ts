import {
  applyRfqExtractionToDraft,
  createDraftForRfqExtractionSession,
  createOpportunityExtractionId,
  markRfqExtractionFailed,
  mergeExtractionIntoDraft,
  type OpportunityExtractionResult,
} from "@/lib/opportunities/opportunityIntake"

function extraction(extractionId: string, documentName: string, values: Record<string, string>): OpportunityExtractionResult {
  return {
    extractionId,
    documentName,
    analyzedAt: "2026-08-04T00:00:00.000Z",
    fields: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, { value, confidence: 0.9, source: documentName }]),
    ) as OpportunityExtractionResult["fields"],
  }
}

describe("RFQ extraction session state", function () {
  it("replaces RFQ A values with RFQ B values in a new upload session", function () {
    const draftA = createDraftForRfqExtractionSession({ fileName: "rfq-a.pdf", extractionId: "extract-a" })
    const appliedA = applyRfqExtractionToDraft(draftA, extraction("extract-a", "rfq-a.pdf", {
      referenceNumber: "RFQ-A",
      opportunityTitle: "A title",
      clientName: "A client",
      department: "A department",
      municipality: "A municipality",
      closingDate: "2026-09-01",
      estimatedValue: "1000",
      category: "A category",
      description: "A description",
      assignedContractorId: "contractor-a",
    }))

    const draftB = createDraftForRfqExtractionSession({ fileName: "rfq-b.pdf", extractionId: "extract-b" })
    const appliedB = applyRfqExtractionToDraft(draftB, extraction("extract-b", "rfq-b.pdf", {
      referenceNumber: "RFQ-B",
      opportunityTitle: "B title",
      clientName: "B client",
      department: "B department",
      municipality: "B municipality",
      closingDate: "2026-10-01",
      estimatedValue: "2000",
      category: "B category",
      description: "B description",
      assignedContractorId: "contractor-b",
    }))

    expect(appliedA.referenceNumber).toBe("RFQ-A")
    expect(appliedB.referenceNumber).toBe("RFQ-B")
    expect(appliedB.clientName).toBe("B client")
    expect(appliedB.department).toBe("B department")
    expect(appliedB.municipality).toBe("B municipality")
    expect(appliedB.closingDate).toBe("2026-10-01")
    expect(appliedB.estimatedValue).toBe("2000")
    expect(appliedB.category).toBe("B category")
    expect(appliedB.description).toBe("B description")
    expect(appliedB.assignedContractorId).toBe("contractor-b")
    expect(JSON.stringify(appliedB)).not.toContain("RFQ-A")
    expect(JSON.stringify(appliedB)).not.toContain("contractor-a")
  })

  it("ignores a late RFQ A extraction response after RFQ B is active", function () {
    const draftB = createDraftForRfqExtractionSession({ fileName: "rfq-b.pdf", extractionId: "extract-b" })
    const lateA = applyRfqExtractionToDraft(draftB, extraction("extract-a", "rfq-a.pdf", { referenceNumber: "RFQ-A", clientName: "A client" }))
    expect(lateA).toBe(draftB)
    expect(lateA.referenceNumber).toBe("")
    expect(lateA.clientName).toBe("")
  })

  it("failed latest extraction leaves old values cleared", function () {
    const draftB = createDraftForRfqExtractionSession({ fileName: "rfq-b.pdf", extractionId: "extract-b" })
    const failed = markRfqExtractionFailed(draftB, "extract-b", "OCR failed")
    expect(failed.rfqExtractionStatus).toBe("failed")
    expect(failed.rfqExtractionError).toBe("OCR failed")
    expect(failed.referenceNumber).toBe("")
    expect(failed.clientName).toBe("")
    expect(failed.assignedContractorId).toBe("")
  })

  it("does not allow older extraction metadata to win by confidence when session IDs differ", function () {
    const draftB = createDraftForRfqExtractionSession({ fileName: "rfq-b.pdf", extractionId: "extract-b" })
    const appliedB = applyRfqExtractionToDraft(draftB, extraction("extract-b", "rfq-b.pdf", { referenceNumber: "RFQ-B" }))
    const lateA = applyRfqExtractionToDraft(appliedB, extraction("extract-a", "rfq-a.pdf", { referenceNumber: "RFQ-A" }))
    expect(lateA.referenceNumber).toBe("RFQ-B")
    expect(lateA.extractionMetadata).toHaveLength(1)
  })

  it("creates unique extraction and draft IDs per upload session", function () {
    const idA = createOpportunityExtractionId()
    const idB = createOpportunityExtractionId()
    const draftA = createDraftForRfqExtractionSession({ fileName: "rfq-a.pdf", extractionId: idA })
    const draftB = createDraftForRfqExtractionSession({ fileName: "rfq-b.pdf", extractionId: idB })
    expect(idA).not.toBe(idB)
    expect(draftA.draftId).not.toBe(draftB.draftId)
    expect(draftA.activeRfqExtractionId).toBe(idA)
    expect(draftB.activeRfqExtractionId).toBe(idB)
  })

  it("documents the old unsafe merge behaviour for stale extracted fields", function () {
    const draftA = createDraftForRfqExtractionSession({ fileName: "rfq-a.pdf", extractionId: "extract-a" })
    const appliedA = applyRfqExtractionToDraft(draftA, extraction("extract-a", "rfq-a.pdf", { referenceNumber: "RFQ-A" }))
    const staleMerge = mergeExtractionIntoDraft(appliedA, extraction("extract-b", "rfq-b.pdf", { clientName: "B client" }))
    expect(staleMerge.referenceNumber).toBe("RFQ-A")
    expect(staleMerge.clientName).toBe("B client")
  })
})

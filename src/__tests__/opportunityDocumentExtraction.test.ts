import { mergeExtractionIntoDraft, createOpportunityDraft } from "@/lib/opportunities/opportunityIntake";

const extractTextFromPdf = jest.fn();

jest.mock("@/lib/pdf/extractTextFromPdf", () => ({
  extractTextFromPdf: (...args: unknown[]) => extractTextFromPdf(...args),
}));

import { extractOpportunityMetadataFromPdf } from "@/lib/opportunities/opportunityDocumentExtraction";

describe("opportunity document extraction label safety", () => {
  beforeEach(() => {
    extractTextFromPdf.mockReset();
  });

  it("rejects label-only contact-person contamination while retaining raw evidence", async () => {
    extractTextFromPdf.mockResolvedValue("Department: Supply Chain CONTACT PERSON");
    const result = await extractOpportunityMetadataFromPdf({
      fileName: "rfq.pdf",
      buffer: Buffer.from("pdf"),
      extractionId: "extract-1",
    });

    expect(result.fields.department).toBeUndefined();
    expect(result.extractedText).toContain("Supply Chain CONTACT PERSON");
  });

  it("keeps valid same-line department values", async () => {
    extractTextFromPdf.mockResolvedValue("Department: Infrastructure Services");
    const result = await extractOpportunityMetadataFromPdf({
      fileName: "rfq.pdf",
      buffer: Buffer.from("pdf"),
    });

    expect(result.fields.department?.value).toBe("Infrastructure Services");
  });

  it("keeps missing fields reviewable and does not overwrite a reviewed value", async () => {
    extractTextFromPdf.mockResolvedValue("Department: CONTACT PERSON");
    const result = await extractOpportunityMetadataFromPdf({
      fileName: "rfq.pdf",
      buffer: Buffer.from("pdf"),
    });
    const reviewed = createOpportunityDraft("draft-reviewed");
    reviewed.department = "Reviewed department";
    reviewed.fieldSources.department = "manual";

    const merged = mergeExtractionIntoDraft(reviewed, result);
    expect(result.fields.department).toBeUndefined();
    expect(merged.department).toBe("Reviewed department");
    expect(merged.fieldSources.department).toBe("manual");
  });
});
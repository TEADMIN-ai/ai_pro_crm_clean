import { renderToStaticMarkup } from "react-dom/server";
import DocumentVerificationReviewPanel from "@/components/contractors/DocumentVerificationReviewPanel";
import type { ContractorDocument } from "@/types/document";

jest.mock("@/lib/client/authFetch", () => ({
  authFetch: jest.fn(),
}));

describe("DocumentVerificationReviewPanel", () => {
  test("renders correct badge and action state for PASS, REVIEW, and FAIL", () => {
    const documents: ContractorDocument[] = [
      {
        id: "cipc",
        contractorId: "contractor-1",
        documentName: "CIPC Registration",
        fileUrl: "https://example.com/cipc.pdf",
        validationStatus: "PASS",
        confidenceScore: 96,
      },
      {
        id: "taxClearance",
        contractorId: "contractor-1",
        documentName: "Tax Clearance",
        fileUrl: "https://example.com/tax.pdf",
        validationStatus: "REVIEW",
        confidenceScore: 48,
        missingFields: ["registrationNumber"],
        confidenceNotes: ["CIPC or company registration wording detected"],
        suggestions: ["Please verify registration number manually"],
      },
      {
        id: "coida",
        contractorId: "contractor-1",
        documentName: "COIDA",
        fileUrl: "https://example.com/coida.pdf",
        validationStatus: "FAIL",
        reviewReason: "Document appears unrelated to CIPC registration",
      },
    ];

    const markup = renderToStaticMarkup(
      <DocumentVerificationReviewPanel
        contractorId="contractor-1"
        documents={documents}
        canReview
        onUpdatedAction={() => undefined}
      />
    );

    expect(markup).toContain("Verified");
    expect(markup).toContain("Needs Review");
    expect(markup).toContain("Failed");
    expect(markup).toContain("Approve");
    expect(markup).toContain("Reject");
    expect(markup).toContain("Request New Upload");
    expect(markup).toContain("Please verify registration number manually");
    expect(markup).toContain("Document appears unrelated to CIPC registration");
  });
});

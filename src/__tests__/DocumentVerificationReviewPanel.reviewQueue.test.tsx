import { renderToStaticMarkup } from "react-dom/server";

import DocumentVerificationReviewPanel from "@/components/deals/DocumentVerificationReviewPanel";
import type { ContractorDocument } from "@/types/document";

jest.mock("@/lib/client/authFetch", () => ({
  authFetch: jest.fn(),
}));

describe("DocumentVerificationReviewPanel review queue filtering", () => {
  test("hides verified documents and keeps pending ones visible", () => {
    const documents: ContractorDocument[] = [
      {
        id: "verified-doc",
        contractorId: "contractor-1",
        documentName: "Verified Document",
        fileUrl: "https://example.com/verified.pdf",
        verified: true,
        validationStatus: "PASS",
      },
      {
        id: "pending-doc",
        contractorId: "contractor-1",
        documentName: "Pending Document",
        fileUrl: "https://example.com/pending.pdf",
        verified: false,
        validationStatus: "REVIEW",
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

    expect(markup).not.toContain("Verified Document");
    expect(markup).toContain("Pending Document");
  });

  test("renders empty state when only verified documents are supplied", () => {
    const documents: ContractorDocument[] = [
      {
        id: "verified-doc",
        contractorId: "contractor-1",
        documentName: "Verified Document",
        fileUrl: "https://example.com/verified.pdf",
        verified: true,
        validationStatus: "PASS",
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

    expect(markup).toContain("No pending documents");
    expect(markup).not.toContain("Verified Document");
  });
});

import { renderToStaticMarkup } from "react-dom/server";

import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";
import type { ContractorDocument } from "@/types/document";

jest.mock("@/lib/contractors/uploadContractorDocument", () => ({
  uploadContractorDocument: jest.fn(),
}));

describe("ContractorDocumentUploader document viewer rendering", () => {
  test("renders a View action for a legacy direct-storage URL without exposing it as a link", () => {
    const documents: ContractorDocument[] = [
      {
        id: "bbbee",
        contractorId: "contractor-1",
        documentType: "bbbee",
        fileUrl: "https://storage.googleapis.com/legacy-bucket/contractors/contractor-1/bbbee_123.pdf",
        storagePath: "contractors/contractor-1/bbbee_123.pdf",
        status: "uploaded",
      },
    ];

    const markup = renderToStaticMarkup(
      <ContractorDocumentUploader contractorId="contractor-1" documents={documents} />,
    );

    expect(markup).toContain("View document");
    expect(markup).toContain("Uploaded");
    expect(markup).not.toContain("https://storage.googleapis.com/legacy-bucket");
  });
});

import {
  extractFileNameFromStoragePath,
  extractFileNameFromUrl,
  resolveDocumentFileName,
} from "@/lib/documents/normalizeDocumentName";

describe("normalizeDocumentName", () => {
  test("extracts filename from storagePath", () => {
    expect(
      extractFileNameFromStoragePath("contractors/abc/documents/Torque_Empire_Tender_Quote.pdf")
    ).toBe("Torque_Empire_Tender_Quote.pdf");
  });

  test("extracts filename from url query param name", () => {
    const url =
      "https://example.com/download?name=contractors%2Fabc%2Fdocuments%2FTorque_Empire_Cert.pdf";
    expect(extractFileNameFromUrl(url)).toBe("Torque_Empire_Cert.pdf");
  });

  test("extracts filename from firebase-style download url path", () => {
    const url =
      "https://firebasestorage.googleapis.com/v0/b/app/o/contractors%2Fabc%2Fdocuments%2FTorque_Empire_COR15.1A.pdf?alt=media";
    expect(extractFileNameFromUrl(url)).toBe("Torque_Empire_COR15.1A.pdf");
  });

  test("resolves filename with required fallback order", () => {
    const resolved = resolveDocumentFileName({
      fileName: "Recovered document",
      originalName: "",
      filename: "",
      name: "TorqueEmpireTaxNumber_7110832245.pdf",
      title: "ShouldNotWin.pdf",
      storagePath: "contractors/abc/documents/TorqueEmpireFromPath.pdf",
      url: "https://example.com/download?name=contractors%2Fabc%2Fdocuments%2FFromUrl.pdf",
    });

    expect(resolved).toBe("TorqueEmpireTaxNumber_7110832245.pdf");
  });
});

const authFetch = jest.fn();

jest.mock("@/lib/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

import {
  buildContractorDocumentViewRequestUrl,
  hasContractorDocumentViewLocator,
  openContractorDocument,
  resolveContractorDocumentViewType,
} from "@/lib/contractors/contractorDocumentViewer";
import type { ContractorDocument } from "@/types/document";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function popupStub() {
  return {
    opener: {},
    location: { href: "about:blank" },
    close: jest.fn(),
  } as unknown as Window;
}

describe("contractor document viewer helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(["cipc", "bbbee", "taxClearance", "coida", "bankConfirmation", "csd", "cidb"])(
    "builds the TEOS JSON download endpoint for %s",
    (documentType) => {
      expect(buildContractorDocumentViewRequestUrl("contractor-1", documentType)).toBe(
        `/api/contractors/contractor-1/documents/${encodeURIComponent(documentType)}/download?format=json`,
      );
    },
  );

  test("calls TEOS download API and opens the returned signed URL directly", async () => {
    const popup = popupStub();
    const openWindow = jest.fn(() => popup);
    authFetch.mockResolvedValue(jsonResponse({ success: true, url: "https://storage.googleapis.com/signed.pdf" }));

    const signedUrl = await openContractorDocument({
      contractorId: "contractor-1",
      documentType: "bbbee",
      openWindow,
    });

    expect(signedUrl).toBe("https://storage.googleapis.com/signed.pdf");
    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch.mock.calls[0][0]).toBe("/api/contractors/contractor-1/documents/bbbee/download?format=json");
    expect(authFetch.mock.calls[0][0]).not.toContain("storage.googleapis.com");
    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith("about:blank", "_blank");
    expect((popup.location as Location).href).toBe("https://storage.googleapis.com/signed.pdf");
  });

  test("opens the signed URL directly when the initial popup is blocked", async () => {
    const openWindow = jest.fn(() => null);
    authFetch.mockResolvedValue(jsonResponse({ success: true, url: "https://storage.googleapis.com/signed-csd.pdf" }));

    await openContractorDocument({
      contractorId: "contractor-1",
      documentType: "csd",
      openWindow,
    });

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(authFetch.mock.calls[0][0]).toBe("/api/contractors/contractor-1/documents/csd/download?format=json");
    expect(openWindow).toHaveBeenCalledTimes(2);
    expect(openWindow).toHaveBeenNthCalledWith(1, "about:blank", "_blank");
    expect(openWindow).toHaveBeenNthCalledWith(2, "https://storage.googleapis.com/signed-csd.pdf", "_blank", "noopener,noreferrer");
  });

  test("ignores legacy direct Firebase Storage URLs when deriving the viewer request", async () => {
    const legacyDocument = {
      id: "legacy-doc",
      contractorId: "contractor-1",
      documentType: "cidb",
      fileUrl: "https://storage.googleapis.com/legacy-bucket/contractors/contractor-1/cidb_123.pdf",
      downloadURL: "https://firebasestorage.googleapis.com/v0/b/legacy/o/cidb_123.pdf",
    } satisfies ContractorDocument;
    const popup = popupStub();
    const openWindow = jest.fn(() => popup);
    authFetch.mockResolvedValue(jsonResponse({ success: true, url: "https://storage.googleapis.com/fresh-signed.pdf" }));

    expect(hasContractorDocumentViewLocator(legacyDocument)).toBe(true);
    await openContractorDocument({
      contractorId: legacyDocument.contractorId,
      documentType: resolveContractorDocumentViewType(legacyDocument),
      openWindow,
    });

    expect(authFetch).toHaveBeenCalledWith(
      "/api/contractors/contractor-1/documents/cidb/download?format=json",
      expect.any(Object),
    );
    expect(authFetch.mock.calls[0][0]).not.toBe(legacyDocument.fileUrl);
    expect((popup.location as Location).href).toBe("https://storage.googleapis.com/fresh-signed.pdf");
  });

  test("closes the popup and reports the TEOS error on failure", async () => {
    const popup = popupStub();
    const openWindow = jest.fn(() => popup);
    authFetch.mockResolvedValue(jsonResponse({ error: "Document not found" }, 404));

    await expect(
      openContractorDocument({
        contractorId: "contractor-1",
        documentType: "bankConfirmation",
        openWindow,
      }),
    ).rejects.toThrow("Document not found");

    expect((popup.close as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

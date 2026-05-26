import { PDFDocument } from "pdf-lib";

import { createAnchorResolver } from "@/lib/empirePdf/anchorDetection";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { renderTemplateField } from "@/lib/empirePdf/renderer";

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
  StandardFonts: {
    Helvetica: "Helvetica",
  },
}));

jest.mock("@/lib/empirePdf/anchorDetection", () => ({
  createAnchorResolver: jest.fn(),
}));

jest.mock("@/lib/empirePdf/renderer", () => ({
  renderTemplateField: jest.fn(),
}));

jest.mock("@/lib/empirePdf/semanticContext", () => ({
  buildSemanticProfile: jest.fn((profile) => profile),
}));

jest.mock("@/lib/empirePdf/semanticRegistry", () => ({
  resolveSemanticField: jest.fn(() => ({
    value: "Empire Pty Ltd",
    aliasMatched: "companyName",
    source: "profile",
    sourceField: "contractor.companyName",
    semanticAliasUsed: "companyName",
    confidence: 0.95,
    missingDependencies: [],
    reviewFlags: [],
  })),
}));

jest.mock("@/lib/empirePdf/templates", () => ({
  EMPIRE_PDF_TEMPLATE_REGISTRY: {
    sbd1: {
      templateKey: "sbd1",
      formId: "SBD1",
      fields: [
        {
          fieldId: "company_name",
          anchorText: "Company Name",
          pageIndex: 0,
        },
      ],
    },
    sbd4: {
      templateKey: "sbd4",
      formId: "SBD4",
      fields: [
        {
          fieldId: "declaration_name",
          anchorText: "Declaration",
          pageIndex: 0,
        },
      ],
    },
  },
}));

describe("fillTemplateWithIntelligence binary normalization", () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      embedFont: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(Uint8Array.from([7, 8, 9])),
    });

    (createAnchorResolver as jest.Mock).mockResolvedValue({
      detect: jest.fn(() => ({
        pageIndex: 0,
        x: 10,
        y: 20,
        width: 30,
        height: 12,
        confidence: 0.98,
        sourceText: "Anchor",
      })),
    });

    (renderTemplateField as jest.Mock).mockResolvedValue({
      fieldId: "mock-field",
      fieldKey: "SBD1.company_name",
      value: "Empire Pty Ltd",
      rendered: true,
      renderSuccess: true,
      usedFallback: false,
      fallbackUsed: false,
      anchorFound: true,
      matchedAnchor: {
        pageIndex: 0,
        x: 10,
        y: 20,
        width: 30,
        height: 12,
        confidence: 0.98,
        sourceText: "Anchor",
      },
      anchorUsed: true,
      anchorText: "Company Name",
      aliasMatched: "companyName",
      semanticAliasUsed: "companyName",
      source: "contractor.companyName",
      sourceField: "contractor.companyName",
      confidence: 0.91,
      resolutionStrategy: "placement_anchor",
      criticality: "critical",
      missingDependencies: [],
      overflowDetected: false,
      clippingRisk: false,
      multilineOverflowDetected: false,
      renderDurationMs: 11,
      x: 10,
      y: 20,
      fontSize: 10,
      pageIndex: 0,
    });
  });

  afterAll(() => {
    consoleInfo.mockRestore();
  });

  test.each(["sbd1", "sbd4"] as const)(
    "normalizes Buffer template bytes before intelligent initialization for %s",
    async (templateKey) => {
      const templateBytes = Buffer.from([1, 2, 3, 4]);

      await fillTemplateWithIntelligence({
        templateKey,
        templateBytes,
        profile: {
          contractorId: "contractor-1",
          companyName: "Empire Pty Ltd",
          regNumber: "",
          vatNumber: "",
          taxPin: "",
          cidb: "",
          csdNumber: "",
          bankingDetails: "",
          directors: "",
          address: "",
          contactPerson: "",
          email: "",
          phone: "",
          missingFields: [],
          sourceAttribution: {},
        },
      });

      const pdfDocumentLoadArg = (PDFDocument.load as jest.Mock).mock.calls[0][0];
      const anchorResolverArg = (createAnchorResolver as jest.Mock).mock.calls[0][0];

      expect(Buffer.isBuffer(pdfDocumentLoadArg)).toBe(false);
      expect(Buffer.isBuffer(anchorResolverArg)).toBe(false);
      expect(pdfDocumentLoadArg).toBeInstanceOf(Uint8Array);
      expect(anchorResolverArg).toBeInstanceOf(Uint8Array);
      expect(Array.from(pdfDocumentLoadArg)).toEqual([1, 2, 3, 4]);
      expect(Array.from(anchorResolverArg)).toEqual([1, 2, 3, 4]);
      expect(consoleInfo).toHaveBeenCalledWith(
        "[EMPIREPDF_INTELLIGENT_FILL]",
        expect.objectContaining({
          stage: "binary_normalization_applied",
          templateKey,
          byteLength: 4,
          originalType: "Buffer",
          normalizedType: "Uint8Array",
        })
      );
      expect(consoleInfo).toHaveBeenCalledWith(
        "[EMPIREPDF_INTELLIGENT_FILL]",
        expect.objectContaining({
          stage: "field_resolution_completed",
          fieldKey: expect.any(String),
          confidence: 0.91,
          anchorUsed: true,
          semanticAliasUsed: "companyName",
          fallbackUsed: false,
          renderDurationMs: 11,
          overflowDetected: false,
          missingDependencies: [],
          renderSuccess: true,
        })
      );
    }
  );
});

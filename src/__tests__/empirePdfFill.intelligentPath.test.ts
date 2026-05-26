import fs from "fs";
import { PDFDocument } from "pdf-lib";

import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: jest.fn(),
    })),
  })),
}));

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
  StandardFonts: {
    Helvetica: "Helvetica",
  },
  rgb: jest.fn(() => ({ r: 0, g: 0, b: 0 })),
}));

jest.mock("@/lib/empirePdf/intelligentFillEngine", () => ({
  fillTemplateWithIntelligence: jest.fn(),
}));

jest.mock("@/lib/pdfs/templates/templateRegistry", () => ({
  TEMPLATE_REGISTRY: {
    sbd1: {
      templateKey: "sbd1",
      pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd1.pdf",
      intelligentTemplate: {
        templateKey: "sbd1",
        formId: "SBD1",
      },
      overlayMap: {
        companyName: {
          profileKey: "companyName",
          page: 0,
          x: 100,
          y: 200,
        },
      },
    },
  },
}));

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-intelligent",
    companyName: "Intelligent Fields Pty Ltd",
    regNumber: "REG-321",
    vatNumber: "",
    taxPin: "",
    cidb: "",
    csdNumber: "",
    bankingDetails: "",
    directors: "",
    address: "",
    contactPerson: "Jane",
    email: "jane@example.com",
    phone: "0110000000",
    missingFields: [],
    sourceAttribution: {},
    ...overrides,
  };
}

describe("empirePdfFill intelligent path", () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from("mock-pdf"));
  });

  test("prefers intelligent fill before legacy overlay fallback", async () => {
    const drawText = jest.fn();

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: () => ({
        getFields: () => [],
      }),
      getPages: () => [{ drawText }],
      embedFont: jest.fn().mockResolvedValue("mock-font"),
      save: jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3])),
    });

    (fillTemplateWithIntelligence as jest.MockedFunction<typeof fillTemplateWithIntelligence>).mockResolvedValue({
      pdfBytes: Uint8Array.from([9, 9, 9]),
      result: {
        warnings: [],
        debugFields: [
          {
            fieldId: "signature_role",
            pageIndex: 0,
            fieldKey: "SBD4.signature_role",
            value: "Authorized Signatory",
            rendered: true,
            renderSuccess: true,
            usedFallback: false,
            fallbackUsed: false,
            anchorFound: true,
            matchedAnchor: null,
            anchorUsed: true,
            anchorText: "CAPACITY",
            aliasMatched: "CAPACITY",
            semanticAliasUsed: "CAPACITY",
            source: "semantic.signatureRole",
            sourceField: "semantic.signatureRole",
            confidence: 0.46,
            resolutionStrategy: "placement_anchor",
            criticality: "important",
            missingDependencies: ["signatoryRole"],
            overflowDetected: false,
            clippingRisk: false,
            multilineOverflowDetected: false,
            renderDurationMs: 7,
            x: 10,
            y: 10,
            fontSize: 9,
          },
        ],
        reviewFlags: [],
        averageConfidence: 0.93,
        renderedFieldCount: 4,
      },
    });

    const result = await fillTenderPack({
      templateKey: "sbd1",
      profile: makeProfile(),
      outputMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(fillTemplateWithIntelligence).toHaveBeenCalled();
    expect(drawText).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.engine).toEqual({
        averageConfidence: 0.93,
        renderedFieldCount: 4,
      });
    }
    expect(consoleInfo).toHaveBeenCalledWith(
      "[CONTRACTOR_PROFILE_INTELLIGENCE]",
      expect.objectContaining({
        stage: "contractor_profile_intelligence_generated",
        contractorId: "contractor-intelligent",
        templateKey: "sbd1",
      })
    );
  });

  test("falls back to overlay if intelligent fill fails", async () => {
    const drawText = jest.fn();

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: () => ({
        getFields: () => [],
      }),
      getPages: () => [{ drawText }],
      embedFont: jest.fn().mockResolvedValue("mock-font"),
      save: jest.fn().mockResolvedValue(Uint8Array.from([4, 5, 6])),
    });

    (fillTemplateWithIntelligence as jest.MockedFunction<typeof fillTemplateWithIntelligence>).mockRejectedValue(
      new Error("anchor calibration failed")
    );

    const result = await fillTenderPack({
      templateKey: "sbd1",
      profile: makeProfile(),
      outputMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(drawText).toHaveBeenCalled();
    if (result.ok) {
      expect(result.warnings).toContain(
        "Intelligent fill failed for 'sbd1', reverting to overlay fallback: anchor calibration failed"
      );
    }
  });

  afterAll(() => {
    consoleInfo.mockRestore();
  });
});

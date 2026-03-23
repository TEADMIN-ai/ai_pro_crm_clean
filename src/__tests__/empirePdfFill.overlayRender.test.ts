import fs from "fs";
import { PDFDocument } from "pdf-lib";

import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";

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

jest.mock("node:fs/promises", () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(),
  },
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

jest.mock("@/lib/pdfs/templates/templateRegistry", () => ({
  TEMPLATE_REGISTRY: {
    sbd8: {
      templateKey: "sbd8",
      pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd8.pdf",
      overlayMap: {
        singleCompanyField: {
          profileKey: "companyName",
          page: 1,
          x: 50,
          y: 75,
          size: 9,
        },
      },
    },
  },
}));

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-2",
    companyName: "Overlay Render Co",
    regNumber: "REG-999",
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
    ...overrides,
  };
}

describe("empirePdfFill overlay rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from("mock-pdf"));
  });

  test("draws mapped value on the configured page and coordinates", async () => {
    const page0 = { drawText: jest.fn() };
    const page1 = { drawText: jest.fn() };
    const page2 = { drawText: jest.fn() };
    const save = jest.fn().mockResolvedValue(Uint8Array.from([4, 5, 6]));

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: () => ({
        getFields: () => [],
      }),
      getPages: () => [page0, page1, page2],
      embedFont: jest.fn().mockResolvedValue("mock-font"),
      save,
    });

    const result = await fillTenderPack({
      templateKey: "sbd8",
      profile: makeProfile({ companyName: "Exact Overlay Value" }),
      outputMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(page1.drawText).toHaveBeenCalledTimes(1);
    expect(page1.drawText).toHaveBeenCalledWith(
      "Exact Overlay Value",
      expect.objectContaining({
        x: 50,
        y: 75,
        size: 9,
      })
    );
    expect(page0.drawText).not.toHaveBeenCalled();
    expect(page2.drawText).not.toHaveBeenCalled();
  });
});

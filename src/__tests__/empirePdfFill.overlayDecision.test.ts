import fs from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import { fillTenderPack } from "@/lib/pdfs/empirePdfFill";

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

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    contractorId: "contractor-1",
    companyName: "Empire Pty Ltd",
    regNumber: "REG-123",
    vatNumber: "VAT-123",
    taxPin: "TAX-123",
    cidb: "CIDB-123",
    csdNumber: "CSD-123",
    bankingDetails: "Bank XYZ",
    directors: "Jane Doe",
    address: "1 Main Street",
    contactPerson: "John Smith",
    email: "john@example.com",
    phone: "0123456789",
    missingFields: [],
    sourceAttribution: {},
    ...overrides,
  };
}

describe("empirePdfFill overlay fallback decision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from("mock-pdf"));
  });

  test("uses overlay rendering when no AcroForm fields exist", async () => {
    const drawText = jest.fn();
    const embedFont = jest.fn().mockResolvedValue("mock-font");
    const save = jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]));

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: () => ({
        getFields: () => [],
      }),
      getPages: () => [{ drawText }],
      embedFont,
      save,
    });

    const result = await fillTenderPack({
      templateKey: "sbd8",
      profile: makeProfile(),
      outputMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(drawText).toHaveBeenCalled();
    expect(embedFont).toHaveBeenCalled();
  });

  test("keeps AcroForm path dominant when fields exist", async () => {
    const setText = jest.fn();
    const drawText = jest.fn();
    const embedFont = jest.fn().mockResolvedValue("mock-font");
    const save = jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]));

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: () => ({
        getFields: () => [
          {
            getName: () => "companyName",
            setText,
          },
        ],
      }),
      getPages: () => [{ drawText }],
      embedFont,
      save,
    });

    const profile = makeProfile({ companyName: "Dominant AcroForm Co" });
    const result = await fillTenderPack({
      templateKey: "sbd8",
      profile,
      outputMode: "preview",
    });

    expect(result.ok).toBe(true);
    expect(setText).toHaveBeenCalledWith("Dominant AcroForm Co");
    expect(drawText).not.toHaveBeenCalled();
    expect(embedFont).not.toHaveBeenCalled();
  });
});


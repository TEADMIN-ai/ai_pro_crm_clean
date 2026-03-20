import { PDFDocument } from "pdf-lib";

import { generateSBD1 } from "@/lib/pdf/sbd1AutoFill";

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
  StandardFonts: {
    Helvetica: "Helvetica",
  },
  rgb: jest.fn((r: number, g: number, b: number) => ({ r, g, b })),
}));

describe("sbd1AutoFill compliance warning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeForm() {
    return {
      getFields: jest.fn(() => []),
    };
  }

  function makeEmbeddedFont() {
    return {
      widthOfTextAtSize: jest.fn((text: string) => text.length),
    };
  }

  test("renders a red warning block when compliance fields are missing", async () => {
    const page = {
      drawRectangle: jest.fn(),
      drawText: jest.fn(),
    };
    const embeddedFont = makeEmbeddedFont();

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: jest.fn(() => makeForm()),
      getPages: () => [page],
      embedFont: jest.fn().mockResolvedValue(embeddedFont),
      save: jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3])),
    });

    await generateSBD1(Uint8Array.from([9, 9, 9]), {
      companyName: "Test Co",
      postalAddress: "PO Box 1",
      streetAddress: "1 Main St",
      telephone: "011 123 4567",
      cellphone: "082 123 4567",
      email: "test@example.com",
      vatNumber: "",
      taxPin: "",
      csdNumber: "",
    });

    expect(page.drawText).toHaveBeenCalledWith(
      "WARNING: Missing required compliance fields:",
      expect.objectContaining({
        color: { r: 1, g: 0, b: 0 },
        size: 8,
      })
    );
    expect(page.drawText).toHaveBeenCalledWith(
      "* VAT Number",
      expect.objectContaining({ color: { r: 1, g: 0, b: 0 } })
    );
    expect(page.drawText).toHaveBeenCalledWith(
      "* Tax Pin",
      expect.objectContaining({ color: { r: 1, g: 0, b: 0 } })
    );
    expect(page.drawText).toHaveBeenCalledWith(
      "* CSD Number",
      expect.objectContaining({ color: { r: 1, g: 0, b: 0 } })
    );
  });

  test("does not render the warning block when compliance fields are present", async () => {
    const page = {
      drawRectangle: jest.fn(),
      drawText: jest.fn(),
    };
    const embeddedFont = makeEmbeddedFont();

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getForm: jest.fn(() => makeForm()),
      getPages: () => [page],
      embedFont: jest.fn().mockResolvedValue(embeddedFont),
      save: jest.fn().mockResolvedValue(Uint8Array.from([4, 5, 6])),
    });

    await generateSBD1(Uint8Array.from([8, 8, 8]), {
      companyName: "Test Co",
      postalAddress: "PO Box 1",
      streetAddress: "1 Main St",
      telephone: "011 123 4567",
      cellphone: "082 123 4567",
      email: "test@example.com",
      vatNumber: "4123456789",
      taxPin: "TAX123456",
      csdNumber: "CSD123456",
    });

    expect(page.drawText).not.toHaveBeenCalledWith(
      "WARNING: Missing required compliance fields:",
      expect.anything()
    );
  });
});

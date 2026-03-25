import { PDFDocument } from "pdf-lib";

import { renderSBD1Overlay } from "@/lib/pdf/sbd1-overlay/renderer";
import type { SBD1OverlayPlan } from "@/lib/pdf/sbd1-overlay/types";

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
  StandardFonts: {
    Helvetica: "Helvetica",
  },
  rgb: jest.fn((r: number, g: number, b: number) => ({ r, g, b })),
}));

describe("renderSBD1Overlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("masks fields, logs render values, and writes the date on the last page", async () => {
    const firstPage = {
      drawRectangle: jest.fn(),
      drawText: jest.fn(),
    };
    const lastPage = {
      drawRectangle: jest.fn(),
      drawText: jest.fn(),
    };
    const font = {
      widthOfTextAtSize: jest.fn(() => 10),
    };
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);

    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getPages: () => [firstPage, lastPage],
      embedFont: jest.fn().mockResolvedValue(font),
      save: jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3])),
    });

    const plan: SBD1OverlayPlan = {
      textInstructions: [
        {
          field: "companyName",
          text: "Example Company",
          x: 148,
          y: 431.2,
          size: 9,
          maxWidth: 415.5,
          mask: {
            x: 144.02,
            y: 426.67,
            width: 423.07,
            height: 14.52,
          },
        },
      ],
      checkboxInstruction: {
        field: "bbbee",
        mark: "X",
        x: 420,
        y: 215,
        size: 10,
      },
      dateInstruction: {
        field: "date",
        text: "2026/03/25",
        x: 180,
        y: 190,
        size: 9,
        maxWidth: 120,
        pageIndex: -1,
      },
    };

    const result = await renderSBD1Overlay(plan, Uint8Array.from([9, 9, 9]));

    expect(result).toEqual(Uint8Array.from([1, 2, 3]));
    expect(firstPage.drawRectangle).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 144.02,
        y: 426.67,
        width: 423.07,
        height: 14.52,
      })
    );
    expect(firstPage.drawText).toHaveBeenCalledWith(
      "Example Company",
      expect.objectContaining({
        x: 148,
        y: 431.2,
        maxWidth: 415.5,
      })
    );
    expect(firstPage.drawText).toHaveBeenCalledWith(
      "X",
      expect.objectContaining({
        x: 420,
        y: 215,
      })
    );
    expect(lastPage.drawText).toHaveBeenCalledWith(
      "2026/03/25",
      expect.objectContaining({
        x: 180,
        y: 190,
        maxWidth: 120,
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "SBD1 overlay render field",
      expect.objectContaining({
        field: "companyName",
        value: "Example Company",
        pageIndex: 0,
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "SBD1 overlay render field",
      expect.objectContaining({
        field: "bbbee",
        value: "X",
        pageIndex: 0,
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "SBD1 overlay render field",
      expect.objectContaining({
        field: "date",
        value: "2026/03/25",
        pageIndex: -1,
      })
    );

    infoSpy.mockRestore();
  });
});

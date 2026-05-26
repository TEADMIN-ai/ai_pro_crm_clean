import { getBoundingBoxField } from "@/lib/empirePdf/boundingBoxes";
import { fitTextToBoundingBox, resolveCheckboxInBoundingBox } from "@/lib/empirePdf/layout";

describe("empirePdf bounding box engine", () => {
  const font = {
    widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 0.48),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns calibrated SBD1 boxes for priority fields", () => {
    expect(getBoundingBoxField("SBD1", "company_name")).toEqual(
      expect.objectContaining({
        fieldId: "company_name",
        page: 0,
      })
    );
    expect(getBoundingBoxField("SBD1", "tax_pin")).toEqual(
      expect.objectContaining({
        fieldId: "tax_pin",
      })
    );
    expect(getBoundingBoxField("SBD1", "supplier_type_pty_ltd")).toEqual(
      expect.objectContaining({
        isCheckbox: true,
      })
    );
  });

  test("fits long multiline text inside strict boundaries using font metrics", () => {
    const box = getBoundingBoxField("SBD1", "vat_number");
    expect(box).not.toBeNull();
    const constrainedFont = {
      widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 1.9),
    };

    const layout = fitTextToBoundingBox(
      constrainedFont as never,
      "123 Long Procurement Avenue Building 9 Johannesburg South Africa Procurement District Phase 4 Tender Office Block C",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.fontSize).toBeLessThanOrEqual(box!.maxFontSize);
    expect(layout?.fontSize).toBeGreaterThanOrEqual(box!.minFontSize);
    const lines = layout?.text.split("\n") ?? [];
    expect(lines.length).toBeGreaterThan(1);
    expect(
      lines.every((line) => constrainedFont.widthOfTextAtSize(line, layout!.fontSize) <= layout!.width)
    ).toBe(true);
  });

  test("clips non-multiline overflow instead of crossing borders", () => {
    const box = getBoundingBoxField("SBD1", "tax_pin");
    expect(box).not.toBeNull();

    const layout = fitTextToBoundingBox(
      font as never,
      "123456789012345678901234567890123456789012345678901234567890",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.text.endsWith("...")).toBe(true);
    expect(font.widthOfTextAtSize(layout!.text, layout!.fontSize)).toBeLessThanOrEqual(layout!.width);
  });

  test("resolves checkbox center coordinates deterministically", () => {
    const box = getBoundingBoxField("SBD1", "foreign_supplier_no");
    expect(box).not.toBeNull();

    const checkbox = resolveCheckboxInBoundingBox(box!);

    expect(checkbox).toEqual(
      expect.objectContaining({
        centerX: (box!.xMin + box!.xMax) / 2,
        centerY: (box!.yMin + box!.yMax) / 2,
      })
    );
  });
});

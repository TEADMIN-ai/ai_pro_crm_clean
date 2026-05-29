import { getBoundingBoxField, getBoundingBoxTemplate } from "@/lib/empirePdf/boundingBoxes";
import { fitTextToBoundingBox, fitTextToBox, resolveCheckboxInBoundingBox } from "@/lib/empirePdf/layout";
import { SBD4_TEMPLATE } from "@/lib/empirePdf/templates/sbd4";

describe("EmpirePDF precision engine", () => {
  const font = {
    widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 0.62),
  };

  test("applies adaptive scaling before overflow", () => {
    const box = getBoundingBoxField("SBD4", "company_name");
    expect(box).not.toBeNull();

    const layout = fitTextToBoundingBox(
      {
        widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 1.05),
      } as never,
      "Empire Infrastructure Holdings Limited",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.fontSize).toBeLessThan(box!.maxFontSize);
    expect(layout?.fontSize).toBeGreaterThanOrEqual(box!.minFontSize);
    expect(layout?.overflowDetected).toBe(false);
  });

  test("wraps multiline content on spaces without breaking words", () => {
    const box = getBoundingBoxField("SBD1", "postal_address");
    expect(box).not.toBeNull();
    const narrowBox = {
      ...box!,
      xMax: box!.xMin + 280,
      width: 280,
      minFontSize: box!.maxFontSize,
      maxLines: 4,
      yMax: box!.yMin + 60,
      height: 60,
    };

    const input = "Empire Procurement House Block C Rivonia Boulevard";
    const layout = fitTextToBoundingBox(
      {
        widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 1.5),
      } as never,
      input,
      narrowBox
    );

    expect(layout).not.toBeNull();
    expect(layout?.lines.length).toBeGreaterThan(1);
    expect(layout?.lines.join(" ")).toBe(input);
    expect(layout?.lineCount).toBeLessThanOrEqual(narrowBox.maxLines);
    expect(layout?.overflowDetected).toBe(false);
  });

  test("keeps postal address stress values contained within the calibrated box", () => {
    const box = getBoundingBoxField("SBD1", "postal_address");
    expect(box).not.toBeNull();

    const layout = fitTextToBoundingBox(
      {
        widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 0.64),
      } as never,
      "Tender Administration Unit, Private Bag X128, Procurement House, 39 Rivonia Road Extension, Sandton, Johannesburg, 2146, South Africa",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.lineCount).toBeLessThanOrEqual(2);
    expect(layout?.overflowDetected).toBe(false);
    expect(layout?.fontSize).toBeGreaterThanOrEqual(6.75);
  });

  test("wraps long signature roles inside the SBD4 calibration before truncating", () => {
    const box = getBoundingBoxField("SBD4", "signature_role");
    expect(box).not.toBeNull();

    const layout = fitTextToBoundingBox(
      {
        widthOfTextAtSize: jest.fn((text: string, size: number) => text.length * size * 0.6),
      } as never,
      "Executive Head of Infrastructure Procurement, Governance and Commercial Risk",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.lineCount).toBeLessThanOrEqual(2);
    expect(layout?.overflowDetected).toBe(false);
    expect(layout?.fontSize).toBeGreaterThanOrEqual(6.75);
  });

  test("uses configured truncate overflow behavior for constrained single-line fields", () => {
    const box = getBoundingBoxField("SBD1", "tax_pin");
    expect(box?.overflowBehavior).toBe("truncate");

    const layout = fitTextToBoundingBox(
      font as never,
      "12345678901234567890123456789012345678901234567890",
      box!
    );

    expect(layout).not.toBeNull();
    expect(layout?.text.endsWith("...")).toBe(true);
    expect(layout?.overflowDetected).toBe(true);
  });

  test("centers checkbox marks using the bounding box midpoint", () => {
    const box = getBoundingBoxField("SBD1", "foreign_supplier_no");
    const checkbox = resolveCheckboxInBoundingBox(box!);

    expect(checkbox).toEqual(
      expect.objectContaining({
        centerX: box!.x + box!.width / 2,
        centerY: box!.y + box!.height / 2,
        style: "tick",
      })
    );
  });

  test("keeps fallback anchor rendering deterministic when no anchor is present", () => {
    const field = SBD4_TEMPLATE.fields.find((candidate) => candidate.fieldId === "signature_role");
    expect(field).toBeDefined();

    const layout = fitTextToBox(font as never, "Managing Director", field!, null);

    expect(layout.usedFallback).toBe(true);
    expect(layout.x).toBe(field!.fallback.x);
    expect(layout.width).toBe(field!.fallback.width);
    expect(layout.contentX).toBeGreaterThanOrEqual(field!.fallback.x);
  });

  test("loads versioned calibration metadata for templates and fields", () => {
    const template = getBoundingBoxTemplate("SBD4");
    const box = getBoundingBoxField("SBD1", "company_name");

    expect(template?.templateVersion).toBe("sbd4-sa-v1");
    expect(box?.templateVersion).toBe("sbd1-sa-v1");
    expect(box?.fieldVersion).toBe("1.0.0");
    expect(box?.pageNumber).toBe(1);
  });
});

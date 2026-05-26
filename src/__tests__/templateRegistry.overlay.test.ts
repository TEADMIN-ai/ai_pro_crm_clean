import { TEMPLATE_REGISTRY } from "@/lib/pdfs/templates/templateRegistry";

describe("templateRegistry overlay support", () => {
  test("includes sbd8 entry", () => {
    expect(TEMPLATE_REGISTRY.sbd8).toBeDefined();
  });

  test("sbd8 has non-empty overlayMap", () => {
    const overlayMap = TEMPLATE_REGISTRY.sbd8.overlayMap;

    expect(overlayMap).toBeDefined();
    expect(Object.keys(overlayMap ?? {})).not.toHaveLength(0);
  });

  test("each sbd8 overlay entry has field key + numeric page/x/y", () => {
    const overlayMap = TEMPLATE_REGISTRY.sbd8.overlayMap ?? {};

    for (const [field, coords] of Object.entries(overlayMap)) {
      expect(typeof field).toBe("string");
      expect(field.length).toBeGreaterThan(0);
      expect(typeof coords.page).toBe("number");
      expect(typeof coords.x).toBe("number");
      expect(typeof coords.y).toBe("number");
    }
  });

  test("intelligent templates are registered for SBD1, SBD4, and SBD6", () => {
    expect(TEMPLATE_REGISTRY.sbd1.intelligentTemplate?.formId).toBe("SBD1");
    expect(TEMPLATE_REGISTRY.sbd4.intelligentTemplate?.formId).toBe("SBD4");
    expect(TEMPLATE_REGISTRY.sbd6.intelligentTemplate?.formId).toBe("SBD6.1");
  });
});


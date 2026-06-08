import { compareEmpirePdfVisualLayout } from "@/lib/empirePdf/qa/visualRegression";
import type { EngineDebugField } from "@/lib/empirePdf/templates";

function buildDebugField(overrides: Partial<EngineDebugField> = {}): EngineDebugField {
  return {
    fieldId: "company_name",
    pageIndex: 0,
    fieldKey: "SBD1.company_name",
    value: "Empire",
    rendered: true,
    renderSuccess: true,
    usedFallback: false,
    fallbackUsed: false,
    anchorFound: true,
    matchedAnchor: null,
    anchorUsed: true,
    anchorText: "NAME OF BIDDER",
    aliasMatched: "NAME OF BIDDER",
    semanticAliasUsed: "NAME OF BIDDER",
    source: "profile",
    sourceField: "companyName",
    confidence: 0.98,
    resolutionStrategy: "bounding_box_anchor",
    criticality: "critical",
    missingDependencies: [],
    overflowDetected: false,
    clippingRisk: false,
    multilineOverflowDetected: false,
    validationWarnings: [],
    renderDurationMs: 5,
    x: 10,
    y: 10,
    width: 80,
    height: 12,
    renderedBounds: {
      x: 10,
      y: 10,
      width: 42,
      height: 10,
    },
    fontSize: 9,
    lineHeight: 10,
    templateVersion: "sbd1-sa-v1",
    fieldVersion: "1.0.0",
    ...overrides,
  };
}

describe("EmpirePDF visual regression scoring", () => {
  test("reports coordinate, font, and dimension drift", () => {
    const report = compareEmpirePdfVisualLayout({
      baseline: [buildDebugField()],
      candidate: [
        buildDebugField({
          renderedBounds: {
            x: 14,
            y: 10,
            width: 48,
            height: 10,
          },
          fontSize: 8,
        }),
      ],
    });

    expect(report.driftScore).toBeLessThan(100);
    expect(report.driftEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["coordinate_shift", "font_size_change", "dimension_change"])
    );
  });
});

import { buildCalibrationQaReport, validateRenderedField } from "@/lib/empirePdf/validation";
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
    fontSize: 9,
    lineHeight: 10,
    templateVersion: "sbd1-sa-v1",
    fieldVersion: "1.0.0",
    ...overrides,
  };
}

describe("EmpirePDF renderer validation", () => {
  test("detects duplicate field rendering deterministically", () => {
    const seen = new Set<string>();
    const firstWarnings = validateRenderedField({
      debugField: buildDebugField(),
      page: {
        getSize: () => ({ width: 595, height: 842 }),
      } as never,
      seenFieldKeys: seen,
    });
    const secondWarnings = validateRenderedField({
      debugField: buildDebugField(),
      page: {
        getSize: () => ({ width: 595, height: 842 }),
      } as never,
      seenFieldKeys: seen,
    });

    expect(firstWarnings).toHaveLength(0);
    expect(secondWarnings).toContain("Duplicate field rendering detected for SBD1.company_name");
  });

  test("flags invalid coordinates, negative dimensions, page escape, and overflow", () => {
    const warnings = validateRenderedField({
      debugField: buildDebugField({
        x: Number.NaN,
        y: -4,
        width: -10,
        height: 900,
        overflowDetected: true,
      }),
      page: {
        getSize: () => ({ width: 595, height: 842 }),
      } as never,
      seenFieldKeys: new Set<string>(),
    });

    expect(warnings).toEqual(
      expect.arrayContaining([
        "Invalid coordinates detected for SBD1.company_name",
        "Negative dimensions detected for SBD1.company_name",
        "Rendered content escaped page bounds for SBD1.company_name",
        "Overflow detected for SBD1.company_name",
      ])
    );
  });

  test("compares rendered dimensions against calibrated bounding boxes", () => {
    const warnings = validateRenderedField({
      debugField: buildDebugField({
        renderedBounds: {
          x: 9,
          y: 10,
          width: 82,
          height: 12,
        },
        boundingBox: {
          x: 10,
          y: 10,
          width: 80,
          height: 12,
          pageIndex: 0,
          templateVersion: "sbd1-sa-v1",
          fieldVersion: "1.0.0",
        },
      }),
      page: {
        getSize: () => ({ width: 595, height: 842 }),
      } as never,
      seenFieldKeys: new Set<string>(),
    });

    expect(warnings).toContain("Rendered dimensions exceeded calibrated bounding box for SBD1.company_name");
  });

  test("generates structured calibration QA reports", () => {
    const report = buildCalibrationQaReport({
      formId: "SBD1",
      templateVersion: "sbd1-sa-v1",
      debugFields: [
        buildDebugField({
          validationWarnings: [],
          boundingBox: {
            x: 10,
            y: 10,
            width: 80,
            height: 12,
            pageIndex: 0,
            templateVersion: "sbd1-sa-v1",
            fieldVersion: "1.0.0",
          },
        }),
      ],
    });

    expect(report).toEqual(
      expect.objectContaining({
        document: "SBD1",
        placementAccuracy: 100,
        overflowEvents: 0,
        checkboxAlignmentIssues: 0,
        missingFields: 0,
        calibrationConfidence: 98,
      })
    );
  });
});

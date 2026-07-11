import type {
  PdfLoadedReferenceDocument,
  PdfStaticLayoutAnalysis,
  PdfStaticLayoutRegion,
  PdfStaticLayoutRegionKind,
} from "./types";

export type StaticLayoutRegionDetector = {
  kind: PdfStaticLayoutRegionKind;
  detect(references: PdfLoadedReferenceDocument[]): Promise<PdfStaticLayoutRegion[]>;
};

export class EmptyStaticLayoutRegionDetector implements StaticLayoutRegionDetector {
  constructor(readonly kind: PdfStaticLayoutRegionKind) {}

  async detect(): Promise<PdfStaticLayoutRegion[]> {
    return [];
  }
}

export class StaticLayoutAnalyzer {
  constructor(
    private readonly detectors: StaticLayoutRegionDetector[] = [
      new EmptyStaticLayoutRegionDetector("checkbox_location"),
      new EmptyStaticLayoutRegionDetector("signature_block"),
      new EmptyStaticLayoutRegionDetector("static_label"),
      new EmptyStaticLayoutRegionDetector("table_boundary"),
      new EmptyStaticLayoutRegionDetector("page_margin"),
      new EmptyStaticLayoutRegionDetector("header_region"),
      new EmptyStaticLayoutRegionDetector("footer_region"),
      new EmptyStaticLayoutRegionDetector("reserved_area"),
    ]
  ) {}

  async analyze(params: {
    document: string;
    version?: string;
    references: PdfLoadedReferenceDocument[];
  }): Promise<PdfStaticLayoutAnalysis> {
    const regions: PdfStaticLayoutRegion[] = [];

    for (const detector of this.detectors) {
      regions.push(...(await detector.detect(params.references)));
    }

    return {
      document: params.document,
      version: params.version,
      regions,
      analyzedAt: new Date().toISOString(),
      analyzer: "static-layout-architecture",
      ocrPerformed: false,
      aiPerformed: false,
      imageComparisonPerformed: false,
    };
  }
}

import type {
  PdfDiscoveredField,
  PdfLoadedReferenceDocument,
  PdfStaticLayoutAnalysis,
} from "./types";

export type FieldDiscoveryAnalyzer = {
  discover(params: {
    references: PdfLoadedReferenceDocument[];
    layoutAnalysis?: PdfStaticLayoutAnalysis;
  }): Promise<PdfDiscoveredField[]>;
};

export class EmptyFieldDiscoveryAnalyzer implements FieldDiscoveryAnalyzer {
  async discover(): Promise<PdfDiscoveredField[]> {
    return [];
  }
}

export class FieldDiscoveryPipeline {
  constructor(private readonly analyzers: FieldDiscoveryAnalyzer[] = [new EmptyFieldDiscoveryAnalyzer()]) {}

  async discover(params: {
    references: PdfLoadedReferenceDocument[];
    layoutAnalysis?: PdfStaticLayoutAnalysis;
  }): Promise<PdfDiscoveredField[]> {
    const discovered: PdfDiscoveredField[] = [];

    for (const analyzer of this.analyzers) {
      discovered.push(...(await analyzer.discover(params)));
    }

    return discovered;
  }
}

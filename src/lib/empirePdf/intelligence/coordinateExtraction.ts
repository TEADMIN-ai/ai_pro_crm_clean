import type { PdfCoordinateExtractionResult, PdfDiscoveredField } from "./types";

export class CoordinateExtractionPipeline {
  extract(params: {
    document: string;
    version: string;
    fields: PdfDiscoveredField[];
  }): PdfCoordinateExtractionResult {
    return {
      document: params.document,
      version: params.version,
      fields: params.fields,
      extractedAt: new Date().toISOString(),
      extractionPerformed: false,
    };
  }
}

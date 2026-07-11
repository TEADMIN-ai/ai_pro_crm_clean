import type {
  PdfLoadedReferenceDocument,
  PdfReferenceDocumentDescriptor,
  PdfReferenceDocumentSet,
  PdfReferenceDocumentKind,
  PdfReferenceSource,
} from "./types";

export class DescriptorOnlyReferenceSource implements PdfReferenceSource {
  async load(descriptor: PdfReferenceDocumentDescriptor): Promise<PdfLoadedReferenceDocument> {
    return {
      ...descriptor,
      loadedAt: new Date().toISOString(),
    };
  }
}

export function createReferenceDescriptor(params: {
  documentName: string;
  version?: string;
  municipality?: string;
  kind: PdfReferenceDocumentKind;
  relativePath: string;
  source?: PdfReferenceDocumentDescriptor["source"];
  status?: PdfReferenceDocumentDescriptor["status"];
}): PdfReferenceDocumentDescriptor {
  return {
    documentName: params.documentName,
    version: params.version,
    municipality: params.municipality,
    kind: params.kind,
    relativePath: params.relativePath,
    status: params.status ?? "not_captured",
    source: params.source ?? "reference_library",
  };
}

export async function loadReferenceDocumentSet(
  documentSet: PdfReferenceDocumentSet,
  source: PdfReferenceSource = new DescriptorOnlyReferenceSource()
): Promise<PdfLoadedReferenceDocument[]> {
  const descriptors = [
    documentSet.blankPdf,
    documentSet.approvedPdf,
    documentSet.generatedPdf,
    documentSet.futureDifferenceReport,
    documentSet.validationReport,
  ].filter((descriptor): descriptor is PdfReferenceDocumentDescriptor => Boolean(descriptor));

  return Promise.all(descriptors.map((descriptor) => source.load(descriptor)));
}

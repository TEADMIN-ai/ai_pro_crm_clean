import type {
  JsonFieldMapDocument,
  JsonFieldMapField,
  PdfDiscoveredField,
  PdfFontRule,
} from "./types";

const DEFAULT_SCHEMA_VERSION = "1.0.0";

function toJsonField(field: PdfDiscoveredField): JsonFieldMapField {
  const defaultFont: PdfFontRule | null = field.rectangle
    ? {
        family: "Helvetica",
        size: 10,
        minimumSize: 6,
        bold: false,
      }
    : null;

  return {
    field: field.fieldId,
    fieldId: field.fieldId,
    fieldName: field.fieldName,
    fieldType: field.kind === "checkbox" || field.kind === "signature" ? field.kind : "text",
    page: field.page,
    rectangle: field.rectangle,
    boundingBox: field.rectangle,
    x: field.rectangle?.x ?? null,
    y: field.rectangle?.y ?? null,
    width: field.rectangle?.width ?? null,
    height: field.rectangle?.height ?? null,
    font: defaultFont,
    maximumCharacters: null,
    alignment: field.rectangle ? "left" : null,
    verticalAlignment: field.rectangle ? "baseline" : null,
    overflowRule: field.rectangle ? "review_required" : null,
    checkboxRelationship: field.kind === "checkbox" ? field.fieldId : null,
    signatureRelationship: field.kind === "signature" ? field.fieldId : null,
    referenceSource: field.referenceSource,
    approvalStatus: field.approvalStatus,
    checkbox: field.kind === "checkbox" ? { style: "x", alignmentTolerance: 0.25 } : null,
    signatureZone:
      field.kind === "signature"
        ? { allowImage: true, allowTypedName: true, overlapTolerance: 0.25 }
        : null,
    confidenceMetadata: field.confidenceMetadata,
  };
}

export function buildJsonFieldMap(params: {
  document: string;
  version: string;
  fields: PdfDiscoveredField[];
  schemaVersion?: string;
}): JsonFieldMapDocument {
  const pages = new Map<number, JsonFieldMapField[]>();

  for (const field of params.fields) {
    const pageFields = pages.get(field.page) ?? [];
    pageFields.push(toJsonField(field));
    pages.set(field.page, pageFields);
  }

  return {
    document: params.document,
    version: params.version,
    schemaVersion: params.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    pages: Array.from(pages.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, fields]) => ({ page, fields })),
  };
}

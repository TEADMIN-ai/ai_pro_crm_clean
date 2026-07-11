import type { FieldRegistry } from "./registries";
import type { JsonFieldMapDocument, JsonFieldMapField, PdfFieldMetadata } from "./types";
import type { TenderFormId } from "../templates";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMeasuredField(field: JsonFieldMapField): boolean {
  return Boolean(
    field.boundingBox &&
      field.font &&
      field.alignment &&
      field.verticalAlignment &&
      field.overflowRule &&
      typeof field.confidenceMetadata.score === "number"
  );
}

export function parseJsonFieldMap(value: unknown): JsonFieldMapDocument {
  if (!isRecord(value)) {
    throw new Error("JSON field map must be an object");
  }

  const { document, version, schemaVersion, pages } = value;
  if (typeof document !== "string" || typeof version !== "string" || typeof schemaVersion !== "string") {
    throw new Error("JSON field map requires document, version and schemaVersion strings");
  }

  if (!Array.isArray(pages)) {
    throw new Error("JSON field map requires a pages array");
  }

  return value as JsonFieldMapDocument;
}

export class JsonFieldRegistry implements FieldRegistry {
  private readonly maps: Map<string, JsonFieldMapDocument>;

  constructor(fieldMaps: JsonFieldMapDocument[]) {
    this.maps = new Map(fieldMaps.map((fieldMap) => [fieldMap.document, fieldMap]));
  }

  getField(formId: TenderFormId, fieldId: string): PdfFieldMetadata | null {
    const fieldMap = this.maps.get(formId);
    if (!fieldMap) {
      return null;
    }

    for (const page of fieldMap.pages) {
      const field = page.fields.find((candidate) => (candidate.fieldId ?? candidate.field) === fieldId);
      if (!field || !hasMeasuredField(field)) {
        continue;
      }

      return {
        fieldName: field.fieldId ?? field.field,
        fieldType: field.fieldType,
        page: page.page,
        boundingRectangle: field.boundingBox,
        alignment: field.alignment,
        verticalAlignment: field.verticalAlignment,
        font: field.font,
        wrapAllowed: field.overflowRule === "wrap",
        shrinkAllowed: field.overflowRule === "scale",
        overflowBehaviour: field.overflowRule,
        checkbox: field.checkbox ?? undefined,
        signature: field.signatureZone ?? undefined,
        confidenceScore: field.confidenceMetadata.score,
        criticality: "important",
        source: {
          registry: "empirePdf.intelligence.fieldMaps",
          templateVersion: fieldMap.version,
        },
      };
    }

    return null;
  }
}

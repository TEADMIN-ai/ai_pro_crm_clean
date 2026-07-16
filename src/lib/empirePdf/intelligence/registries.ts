import { getBoundingBoxField } from "../boundingBoxes";
import type { TenderFormId, TemplateFieldDefinition } from "../templates";
import type { PdfBusinessFieldValue, PdfFieldMetadata } from "./types";

export type FieldRegistry = {
  getField(formId: TenderFormId, fieldId: string): PdfFieldMetadata | null;
};

export type BusinessDataRegistry = {
  getValue(fieldName: string): PdfBusinessFieldValue | null;
};

export class StaticBusinessDataRegistry implements BusinessDataRegistry {
  private readonly values: Map<string, PdfBusinessFieldValue>;

  constructor(values: PdfBusinessFieldValue[]) {
    this.values = new Map(values.map((value) => [value.fieldName, value]));
  }

  getValue(fieldName: string): PdfBusinessFieldValue | null {
    return this.values.get(fieldName) ?? null;
  }
}

export class EmpirePdfFieldRegistry implements FieldRegistry {
  getField(formId: TenderFormId, fieldId: string): PdfFieldMetadata | null {
    const boundedField = getBoundingBoxField(formId, fieldId);

    if (!boundedField) {
      return null;
    }

    return {
      fieldName: boundedField.fieldId,
      fieldType: boundedField.isCheckbox ? "checkbox" : "text",
      page: boundedField.page,
      boundingRectangle: {
        x: boundedField.x,
        y: boundedField.y,
        width: boundedField.width,
        height: boundedField.height,
      },
      alignment: boundedField.alignment,
      verticalAlignment: "middle",
      font: {
        family: "Helvetica",
        size: boundedField.maxFontSize,
        minimumSize: boundedField.minFontSize,
        bold: false,
      },
      wrapAllowed: boundedField.multiline,
      shrinkAllowed: boundedField.overflowBehavior === "scale",
      overflowBehaviour: boundedField.overflowBehavior,
      checkbox: boundedField.isCheckbox
        ? {
            style: boundedField.checkboxStyle,
            alignmentTolerance: 0.25,
          }
        : undefined,
      signature: undefined,
      confidenceScore: 1,
      criticality: "important",
      source: {
        registry: "empirePdf.boundingBoxes",
        templateVersion: boundedField.templateVersion,
        fieldVersion: boundedField.fieldVersion,
      },
    };
  }
}

function normalizeTemplateFallback(field: TemplateFieldDefinition) {
  const fallback = field.fallback;
  const textBounds = field.textBounds;

  return {
    x: fallback?.x ?? 0,
    y: fallback?.y ?? 0,
    width: fallback?.width ?? textBounds?.width ?? 160,
    height: fallback?.height ?? textBounds?.height ?? 14,
  };
}

export function templateFieldToMetadata(field: TemplateFieldDefinition): PdfFieldMetadata {
  const fallback = normalizeTemplateFallback(field);

  return {
    fieldName: field.fieldId,
    fieldType: field.fieldType,
    page: field.pageIndex,
    boundingRectangle: {
      x: fallback.x,
      y: fallback.y,
      width: fallback.width,
      height: fallback.height,
    },
    alignment: field.alignment,
    verticalAlignment: "baseline",
    font: {
      family: "Helvetica",
      size: field.maxFontSize ?? 11,
      minimumSize: field.minFontSize ?? 6,
      bold: false,
    },
    wrapAllowed: field.multiline === true,
    shrinkAllowed: field.overflowBehavior === "scale" || !field.overflowBehavior,
    overflowBehaviour: field.overflowBehavior ?? (field.multiline ? "wrap" : "scale"),
    checkbox: field.fieldType === "checkbox"
      ? {
          style: field.checkboxStyle ?? "x",
          alignmentTolerance: 0.25,
        }
      : undefined,
    signature: field.fieldType === "signature"
      ? {
          allowImage: true,
          allowTypedName: true,
          overlapTolerance: 0.25,
        }
      : undefined,
    confidenceScore: 0.6,
    criticality: field.criticality ?? "important",
    source: {
      registry: "empirePdf.templates",
      fieldVersion: field.fieldVersion,
    },
  };
}

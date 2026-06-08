import type { TenderFormId } from "../templates";

import { SBD1_BOUNDING_BOXES } from "./sbd1";
import { SBD4_BOUNDING_BOXES } from "./sbd4";
import { SBD1_CALIBRATION_OVERRIDES, type CalibrationOverride } from "../calibrationOverrides/sbd1";
import type {
  BoundingBoxFieldDefinition,
  BoundingBoxTemplateDefinition,
  RawBoundingBoxFieldDefinition,
} from "./types";

const BOUNDING_BOX_REGISTRY: Partial<Record<TenderFormId, BoundingBoxTemplateDefinition>> = {
  SBD1: SBD1_BOUNDING_BOXES,
  SBD4: SBD4_BOUNDING_BOXES,
};

function normalizeBoundingBoxField(
  templateVersion: string,
  box: RawBoundingBoxFieldDefinition,
  override?: CalibrationOverride
): BoundingBoxFieldDefinition {
  const dx = override?.dx ?? 0;
  const dy = override?.dy ?? 0;
  const dw = override?.dw ?? 0;
  const dh = override?.dh ?? 0;
  const xMin = box.xMin + dx;
  const yMin = box.yMin + dy;
  const width = Math.max(box.xMax - box.xMin + dw, 0);
  const height = Math.max(box.yMax - box.yMin + dh, 0);
  const xMax = xMin + width;
  const yMax = yMin + height;

  return {
    ...box,
    xMin,
    xMax,
    yMin,
    yMax,
    x: xMin,
    y: yMin,
    width,
    height,
    pageNumber: box.page + 1,
    lineHeight: box.lineHeight ?? box.lineSpacing ?? Math.max(box.maxFontSize + 0.5, 8),
    padding: box.padding ?? 0,
    maxLines: box.maxLines ?? (box.multiline ? Math.max(Math.floor(height / Math.max(box.lineHeight ?? 0, 1)), 1) : 1),
    overflowBehavior: box.overflowBehavior ?? (box.multiline ? "wrap" : "scale"),
    checkboxStyle: box.checkboxStyle ?? "x",
    templateVersion: box.templateVersion ?? templateVersion,
    fieldVersion: box.fieldVersion ?? "1.0.0",
  };
}

function getCalibrationOverride(formId: TenderFormId, fieldId: string): CalibrationOverride | undefined {
  if (formId === "SBD1") {
    return SBD1_CALIBRATION_OVERRIDES[fieldId];
  }

  return undefined;
}

export function getBoundingBoxField(
  formId: TenderFormId,
  fieldId: string
): BoundingBoxFieldDefinition | null {
  const template = BOUNDING_BOX_REGISTRY[formId];
  const box = template?.fields[fieldId];

  return box ? normalizeBoundingBoxField(template.templateVersion, box, getCalibrationOverride(formId, fieldId)) : null;
}

export function getBoundingBoxTemplate(formId: TenderFormId): BoundingBoxTemplateDefinition | null {
  return BOUNDING_BOX_REGISTRY[formId] ?? null;
}

export * from "./types";

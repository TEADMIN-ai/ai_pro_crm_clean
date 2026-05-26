import type { TenderFormId } from "../templates";

import { SBD1_BOUNDING_BOXES } from "./sbd1";
import type { BoundingBoxFieldDefinition } from "./types";

const BOUNDING_BOX_REGISTRY: Partial<Record<TenderFormId, Record<string, BoundingBoxFieldDefinition>>> = {
  SBD1: SBD1_BOUNDING_BOXES,
};

export function getBoundingBoxField(
  formId: TenderFormId,
  fieldId: string
): BoundingBoxFieldDefinition | null {
  return BOUNDING_BOX_REGISTRY[formId]?.[fieldId] ?? null;
}

export * from "./types";

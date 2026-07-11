import type { PdfFieldMetadata, PdfLayoutPlan } from "./types";

export type LayoutRules = {
  plan(field: PdfFieldMetadata, value: PdfLayoutPlan["value"]): PdfLayoutPlan;
};

export class DefaultLayoutRules implements LayoutRules {
  plan(field: PdfFieldMetadata, value: PdfLayoutPlan["value"]): PdfLayoutPlan {
    return {
      field,
      value,
      resolvedRectangle: field.boundingRectangle,
      font: field.font,
      overflowBehaviour: field.overflowBehaviour,
      confidenceScore: Math.min(field.confidenceScore, value?.confidenceScore ?? field.confidenceScore),
    };
  }
}

export type OverflowRules = {
  allowsWrap(field: PdfFieldMetadata): boolean;
  allowsShrink(field: PdfFieldMetadata): boolean;
};

export const defaultOverflowRules: OverflowRules = {
  allowsWrap: (field) => field.wrapAllowed,
  allowsShrink: (field) => field.shrinkAllowed,
};

export type CheckboxRules = {
  requiresCheckboxAlignment(field: PdfFieldMetadata): boolean;
};

export const defaultCheckboxRules: CheckboxRules = {
  requiresCheckboxAlignment: (field) => field.fieldType === "checkbox" || Boolean(field.checkbox),
};

export type SignatureRules = {
  requiresSignatureZone(field: PdfFieldMetadata): boolean;
};

export const defaultSignatureRules: SignatureRules = {
  requiresSignatureZone: (field) => field.fieldType === "signature" || Boolean(field.signature),
};

import { DefaultLayoutRules, type LayoutRules } from "./rules";
import { MetadataValidationEngine, type PdfValidationEngine } from "./validationEngine";
import type { BusinessDataRegistry, FieldRegistry } from "./registries";
import type { PdfLayoutPlan, PdfValidationReport } from "./types";
import type { TenderFormId } from "../templates";

export type PdfIntelligencePipelineInput = {
  formId: TenderFormId;
  fieldIds: string[];
};

export type PdfIntelligencePipelineResult = {
  plans: PdfLayoutPlan[];
  validation: PdfValidationReport;
};

export class PdfIntelligencePipeline {
  constructor(
    private readonly fieldRegistry: FieldRegistry,
    private readonly businessDataRegistry: BusinessDataRegistry,
    private readonly layoutRules: LayoutRules = new DefaultLayoutRules(),
    private readonly validationEngine: PdfValidationEngine = new MetadataValidationEngine()
  ) {}

  plan(input: PdfIntelligencePipelineInput): PdfIntelligencePipelineResult {
    const plans: PdfLayoutPlan[] = [];

    for (const fieldId of input.fieldIds) {
      const field = this.fieldRegistry.getField(input.formId, fieldId);
      if (!field) {
        continue;
      }

      plans.push(this.layoutRules.plan(field, this.businessDataRegistry.getValue(field.fieldName)));
    }

    return {
      plans,
      validation: this.validationEngine.validate(plans),
    };
  }
}

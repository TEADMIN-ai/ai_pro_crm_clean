import { PDFDocument } from "pdf-lib";

import { generateSBD1Template } from "./templates/SBD1";
import { generateSBD4Template } from "./templates/SBD4";
import { generateSBD6Template } from "./templates/SBD6";
import { generateSBD8Template } from "./templates/SBD8";
import { generateSBD9Template } from "./templates/SBD9";

type DealInput = Record<string, unknown>;
type ContractorInput = Record<string, unknown>;
type TemplateGenerator = (deal: DealInput, contractor: ContractorInput) => Promise<Uint8Array>;
export type TemplateKey = "SBD1" | "SBD4" | "SBD6" | "SBD8" | "SBD9";

export const TEMPLATE_MAP: Record<TemplateKey, TemplateGenerator> = {
  SBD1: generateSBD1Template,
  SBD4: generateSBD4Template,
  SBD6: generateSBD6Template,
  SBD8: generateSBD8Template,
  SBD9: generateSBD9Template,
};

const GOVERNMENT_TEMPLATES: TemplateKey[] = ["SBD1", "SBD4", "SBD6", "SBD8", "SBD9"];
const PRIVATE_TEMPLATES: TemplateKey[] = ["SBD1", "SBD4"];

export function getTemplates(deal: DealInput): TemplateKey[] {
  const override = Array.isArray(deal.templateOverride)
    ? deal.templateOverride.filter(
        (value): value is TemplateKey =>
          value === "SBD1" || value === "SBD4" || value === "SBD6" || value === "SBD8" || value === "SBD9"
      )
    : [];

  if (override.length > 0) {
    return override;
  }

  const rawType = typeof deal.type === "string" ? deal.type.trim().toLowerCase() : "";
  if (rawType === "private") {
    return PRIVATE_TEMPLATES;
  }

  return GOVERNMENT_TEMPLATES;
}

export async function generateMergedPack(deal: DealInput, contractor: ContractorInput) {
  const mergedPdf = await PDFDocument.create();
  const selectedTemplates = getTemplates(deal);

  for (const key of selectedTemplates) {
    const generator = TEMPLATE_MAP[key];
    if (!generator) {
      continue;
    }

    const pdfBytes = await generator(deal, contractor);
    const doc = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

export function getMergedPackTemplateIds(deal: DealInput) {
  return getTemplates(deal);
}

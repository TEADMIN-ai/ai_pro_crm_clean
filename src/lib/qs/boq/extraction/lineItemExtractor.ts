import { classifyBoqTrade } from "@/lib/qs/boq/classification/tradeClassifier";
import { normalizeBoqUnit } from "@/lib/qs/boq/normalization/unitNormalizer";
import type { QsBoqConfidence, QsBoqLineItem, QsBoqMaterialMatch } from "@/types/qs";

export type ExtractedBoqLineItem = Omit<QsBoqLineItem, "boqLineItemId" | "boqDocumentId" | "materialMatch" | "createdAt" | "updatedAt"> & {
  materialMatch?: QsBoqMaterialMatch;
};

const QUANTITY_UNIT_PATTERN =
  /(?<quantity>\d+(?:[.,]\d+)?)\s*(?<unit>kg|kgs|kilograms?|sqm|m²|m2|square metres?|square meters?|m³|m3|cubic metres?|cubic meters?|m|metres?|meters?|each|ea|no|nr|bag|bags|box|boxes|pack|packs|ton|tonne|litre|litres|l|roll|rolls|sheet|sheets)\b/i;

function confidenceFor(params: { description: string; quantity?: number | null; unit?: string | null; trade: string }): QsBoqConfidence {
  let score = 0;
  if (params.description.length >= 12) score += 1;
  if (typeof params.quantity === "number") score += 1;
  if (params.unit) score += 1;
  if (params.trade !== "Other") score += 1;

  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\d.]+\s+/, "").trim();
}

function sectionFromLine(line: string, currentSection: string | null): string | null {
  const normalized = line.trim();
  if (/^[A-Z][A-Z\s/&-]{3,}$/.test(normalized) && normalized.length <= 80) {
    return normalized;
  }

  return currentSection;
}

export function extractBoqLineItems(text: string): ExtractedBoqLineItem[] {
  const items: ExtractedBoqLineItem[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let currentSection: string | null = null;

  for (const [index, rawLine] of lines.entries()) {
    currentSection = sectionFromLine(rawLine, currentSection);
    const match = rawLine.match(QUANTITY_UNIT_PATTERN);
    const hasBoqShape = match || /^\d+(\.\d+)*\s+/.test(rawLine) || /\s{2,}\d/.test(rawLine);

    if (!hasBoqShape || rawLine.length < 8) {
      continue;
    }

    const quantityRaw = match?.groups?.quantity?.replace(",", ".");
    const quantity = quantityRaw ? Number(quantityRaw) : null;
    const unit = match?.groups?.unit ?? null;
    const normalizedUnit = normalizeBoqUnit(unit);
    const description = cleanLine(rawLine.replace(match?.[0] ?? "", " "));
    const trade = classifyBoqTrade(`${currentSection ?? ""} ${description}`);
    const confidenceScore = confidenceFor({ description, quantity, unit: normalizedUnit, trade });

    items.push({
      lineNumber: index + 1,
      section: currentSection,
      trade,
      originalText: rawLine,
      description,
      quantity: Number.isFinite(quantity) ? quantity : null,
      unit,
      normalizedUnit,
      confidenceScore,
      status: confidenceScore === "Low" ? "pending" : "accepted",
      notes: null,
    });
  }

  return items;
}

export function summarizeConfidence(items: Array<{ confidenceScore: QsBoqConfidence }>): Record<QsBoqConfidence, number> {
  return items.reduce<Record<QsBoqConfidence, number>>(
    (summary, item) => ({
      ...summary,
      [item.confidenceScore]: summary[item.confidenceScore] + 1,
    }),
    { High: 0, Medium: 0, Low: 0 },
  );
}

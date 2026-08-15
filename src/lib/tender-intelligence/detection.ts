import { createHash } from "node:crypto";
import type {
  TenderDocumentAnalysis,
  TenderDocumentCategory,
  TenderEvidenceField,
  TenderExtractedLineItem,
  TenderPricingClassification,
  TenderPricingTableCandidate,
  TenderSourceEvidence,
} from "@/types/tenderIntelligence";

type DocumentText = {
  documentId: string;
  filename: string;
  text: string;
  pageCount: number;
};

const PRICING_TERMS = [
  "bill of quantities",
  "boq",
  "pricing schedule",
  "price schedule",
  "schedule of prices",
  "schedule of rates",
  "unit rate schedule",
  "item schedule",
  "commercial schedule",
  "financial proposal",
  "offer schedule",
  "returnable pricing schedule",
  "form of offer",
  "activity schedule",
  "pricing data",
  "price list",
  "tender sum",
  "schedule of cost components",
];

const TABLE_COLUMN_TERMS = [
  "item",
  "description",
  "specification",
  "quantity",
  "qty",
  "unit",
  "unit price",
  "unit rate",
  "amount",
  "line total",
  "vat",
  "delivery",
  "total",
  "tendered rate",
];

const FALSE_POSITIVE_TERMS = [
  "evaluation criteria",
  "functionality points",
  "preference points",
  "score",
  "points",
  "financial statement",
  "revenue",
  "turnover",
  "administrative compliance",
  "checklist",
  "contact person",
  "telephone",
  "performance table",
];

const UNIT_PATTERN = /\b(each|ea|no|nr|unit|m|m2|mÂ²|m3|mÂ³|kg|l|litre|hour|day|month|sum|lot|sqm|km|ton|tonne|bag|box)\b/i;
const MONEY_PATTERN = /(?:^|\s)(?:R\s*)?\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})?(?:\s|$)/;
const QUANTITY_PATTERN = /\b\d+(?:[.,]\d+)?\b/;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

function excerptAround(text: string, term: string): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index < 0) return text.replace(/\s+/g, " ").trim().slice(0, 220);
  return text.slice(Math.max(0, index - 90), Math.min(text.length, index + term.length + 130)).replace(/\s+/g, " ").trim();
}

function splitPages(text: string, pageCount: number): string[] {
  const explicitPages = text.split(/\n\s*---+\s*page\s+\d+\s*---+\s*\n/i);
  if (explicitPages.length > 1) return explicitPages;
  if (pageCount <= 1) return [text];
  const lines = text.split(/\n+/);
  const chunkSize = Math.max(1, Math.ceil(lines.length / pageCount));
  return Array.from({ length: pageCount }, (_, index) => lines.slice(index * chunkSize, (index + 1) * chunkSize).join("\n"));
}

function evidence(document: DocumentText, page: number | null, excerpt: string, confidence: number): TenderSourceEvidence {
  return {
    sourceDocumentId: document.documentId,
    sourceDocumentName: document.filename,
    sourcePage: page,
    excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 300),
    confidence,
  };
}

export function hashDocumentText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function classifyTenderDocument(filename: string, text: string): TenderDocumentCategory {
  const haystack = normalizeText(`${filename} ${text.slice(0, 3000)}`);
  if (/\bamend/.test(haystack) || haystack.includes("addendum")) return "AMENDMENT";
  if (haystack.includes("bill of quantities") || /\bboq\b/.test(haystack)) return "BOQ";
  if (haystack.includes("schedule of rates")) return "SCHEDULE_OF_RATES";
  if (haystack.includes("pricing schedule") || haystack.includes("commercial schedule") || haystack.includes("returnable pricing")) return "PRICING_SCHEDULE";
  if (haystack.includes("form of offer")) return "FORM_OF_OFFER";
  if (haystack.includes("briefing") || haystack.includes("site meeting")) return "BRIEFING_DOCUMENT";
  if (haystack.includes("annexure") || haystack.includes("appendix")) return "ANNEXURE";
  if (haystack.includes("returnable")) return "RETURNABLE_SCHEDULE";
  if (haystack.includes("specification") || haystack.includes("scope of work")) return "SPECIFICATION";
  if (/\b(rfq|rfp|request for quotation|request for proposal|invitation to bid|tender notice)\b/.test(haystack)) return "RFQ_RFP_NOTICE";
  return "SUPPORTING_TENDER_DOCUMENT";
}

export function detectPricingTerminology(documents: DocumentText[]): TenderSourceEvidence[] {
  const matches: TenderSourceEvidence[] = [];
  for (const document of documents) {
    const pages = splitPages(document.text, document.pageCount);
    pages.forEach((pageText, pageIndex) => {
      const normalized = normalizeText(pageText);
      for (const term of PRICING_TERMS) {
        if (normalized.includes(term)) {
          matches.push(evidence(document, pageIndex + 1, excerptAround(pageText, term), term === "boq" ? 0.86 : 0.9));
          break;
        }
      }
    });
  }
  return matches;
}

function parseCells(row: string): string[] {
  const normalized = row.replace(/\t/g, " | ").replace(/\s{2,}/g, " | ");
  const cells = normalized.split(/\s*\|\s*/).map((cell) => cell.trim()).filter(Boolean);
  return cells.length > 1 ? cells : row.trim().split(/\s{3,}/).map((cell) => cell.trim()).filter(Boolean);
}

function pricingSignalsFor(row: string, heading: string): string[] {
  const text = normalizeText(`${heading} ${row}`);
  const signals: string[] = [];
  for (const term of PRICING_TERMS) if (text.includes(term)) signals.push(term);
  for (const term of TABLE_COLUMN_TERMS) if (text.includes(term)) signals.push(term);
  if (UNIT_PATTERN.test(row)) signals.push("unit pattern");
  if (MONEY_PATTERN.test(row)) signals.push("money amount");
  if (QUANTITY_PATTERN.test(row)) signals.push("quantity number");
  return Array.from(new Set(signals));
}

function falsePositiveSignalsFor(row: string, heading: string): string[] {
  const text = normalizeText(`${heading} ${row}`);
  return FALSE_POSITIVE_TERMS.filter((term) => text.includes(term));
}

function tableConfidence(signals: string[], falsePositiveSignals: string[], cells: string[]): number {
  let score = 0.2;
  score += Math.min(0.5, signals.length * 0.08);
  if (cells.length >= 4) score += 0.12;
  if (signals.some((signal) => /pricing|boq|rates|amount|unit price|quantity/.test(signal))) score += 0.15;
  score -= Math.min(0.45, falsePositiveSignals.length * 0.13);
  return Math.max(0.05, Math.min(0.98, Number(score.toFixed(2))));
}

function normalizedCells(cells: string[]): Record<string, string | number | boolean | null> {
  const joined = cells.join(" | ");
  const quantity = joined.match(/\b(\d+(?:[.,]\d+)?)\b/)?.[1]?.replace(",", ".");
  const moneyMatches = [...joined.matchAll(/R?\s*(\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})?)/g)].map((match) => Number(match[1].replace(/[ ,]/g, ""))).filter(Number.isFinite);
  return {
    itemNumber: cells[0] ?? null,
    description: cells.slice(1, Math.max(2, cells.length - 3)).join(" ") || cells.join(" "),
    quantity: quantity ? Number(quantity) : null,
    unit: cells.find((cell) => UNIT_PATTERN.test(cell)) ?? null,
    unitPrice: moneyMatches.length > 1 ? moneyMatches[moneyMatches.length - 2] : null,
    amount: moneyMatches.length ? moneyMatches[moneyMatches.length - 1] : null,
  };
}

export function detectPricingTables(documents: DocumentText[]): TenderPricingTableCandidate[] {
  const candidates: TenderPricingTableCandidate[] = [];
  for (const document of documents) {
    const pages = splitPages(document.text, document.pageCount);
    pages.forEach((pageText, pageIndex) => {
      const rows = pageText.split(/\n+/).map((row) => row.trim()).filter(Boolean);
      let tableIndex = 0;
      let currentHeading: string | null = null;
      rows.forEach((row, rowIndex) => {
        if (/^[A-Z0-9 .:/()-]{8,}$/.test(row) && row.length < 120 && !MONEY_PATTERN.test(row)) {
          currentHeading = row;
        }
        const cells = parseCells(row);
        const signals = pricingSignalsFor(row, currentHeading ?? "");
        const falseSignals = falsePositiveSignalsFor(row, currentHeading ?? "");
        const hasStructure = cells.length >= 3 || (MONEY_PATTERN.test(row) && UNIT_PATTERN.test(row));
        if (!hasStructure || signals.length < 3) return;
        const confidence = tableConfidence(signals, falseSignals, cells);
        if (confidence < 0.35) return;
        if (rowIndex === 0 || /item|description|qty|quantity|amount|rate/i.test(rows[rowIndex - 1] ?? "")) tableIndex += 1;
        candidates.push({
          id: `${document.documentId}-p${pageIndex + 1}-r${rowIndex + 1}`,
          sourceDocumentId: document.documentId,
          sourcePage: pageIndex + 1,
          sourceTableIndex: Math.max(1, tableIndex),
          sourceHeading: currentHeading,
          sourceRow: rowIndex + 1,
          rawCells: cells,
          normalizedCells: normalizedCells(cells),
          confidence,
          reviewStatus: confidence >= 0.75 && falseSignals.length === 0 ? "EXTRACTED" : "REVIEW_REQUIRED",
          falsePositiveSignals: falseSignals,
          pricingSignals: signals,
        });
      });
    });
  }
  return mergeRepeatedHeaders(candidates);
}

function isHeaderCandidate(candidate: TenderPricingTableCandidate): boolean {
  const text = candidate.rawCells.join(" ").toLowerCase();
  return /item|description|qty|quantity|unit|amount|rate/.test(text) && !MONEY_PATTERN.test(text);
}

function mergeRepeatedHeaders(candidates: TenderPricingTableCandidate[]): TenderPricingTableCandidate[] {
  return candidates.filter((candidate, index, all) => {
    if (!isHeaderCandidate(candidate)) return true;
    return index === all.findIndex((other) => other.sourceDocumentId === candidate.sourceDocumentId && other.sourcePage === candidate.sourcePage && isHeaderCandidate(other));
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractLineItems(candidates: TenderPricingTableCandidate[]): TenderExtractedLineItem[] {
  const rows = candidates.filter((candidate) => !isHeaderCandidate(candidate));
  const items: TenderExtractedLineItem[] = [];
  for (const candidate of rows) {
    const cells = candidate.normalizedCells;
    const description = typeof cells.description === "string" && cells.description.trim() ? cells.description.trim() : candidate.rawCells.join(" ");
    const lowConfidence = candidate.confidence < 0.7 || candidate.falsePositiveSignals.length > 0 || !toNumber(cells.quantity) || !toNumber(cells.amount);
    const previous = items[items.length - 1];
    const looksSplit = previous && !toNumber(cells.quantity) && !MONEY_PATTERN.test(candidate.rawCells.join(" ")) && description.length > 8;
    if (looksSplit) {
      previous.description = `${previous.description} ${description}`.trim();
      previous.rawText = `${previous.rawText}\n${candidate.rawCells.join(" | ")}`;
      previous.reviewStatus = "REVIEW_REQUIRED";
      previous.notes = [previous.notes, "Possible split row merged from following source row."].filter(Boolean).join(" ");
      continue;
    }
    items.push({
      id: `${candidate.id}-line`,
      sourceDocumentId: candidate.sourceDocumentId,
      sourcePage: candidate.sourcePage,
      sourceTableIndex: candidate.sourceTableIndex,
      sourceRow: candidate.sourceRow,
      itemNumber: typeof cells.itemNumber === "string" ? cells.itemNumber : null,
      description,
      specification: null,
      quantity: toNumber(cells.quantity),
      quantityMode: "FIXED_QUANTITY",
      unit: typeof cells.unit === "string" ? cells.unit : null,
      tenderUnitPrice: toNumber(cells.unitPrice),
      tenderLineTotal: toNumber(cells.amount),
      vatTreatment: /vat/i.test(candidate.rawCells.join(" ")) ? "VAT referenced" : null,
      mandatoryField: true,
      notes: candidate.falsePositiveSignals.length ? `Review false-positive signals: ${candidate.falsePositiveSignals.join(", ")}` : null,
      rawText: candidate.rawCells.join(" | "),
      extractionConfidence: candidate.confidence,
      reviewStatus: lowConfidence ? "REVIEW_REQUIRED" : "EXTRACTED",
      manuallyCorrected: false,
      correctedBy: null,
      correctedAt: null,
    });
  }
  return items;
}

export function classifyPricing(input: {
  documentAnalyses: TenderDocumentAnalysis[];
  terminologyEvidence: TenderSourceEvidence[];
  pricingTables: TenderPricingTableCandidate[];
  fullText: string;
}): TenderPricingClassification {
  const filenameBoq = input.documentAnalyses.some((doc) => /boq|bill of quantities/i.test(doc.filename));
  const text = normalizeText(input.fullText);
  const strongTables = input.pricingTables.filter((table) => table.confidence >= 0.7 && table.falsePositiveSignals.length === 0);
  if (filenameBoq && strongTables.length > 0) return "SEPARATE_BOQ_DOCUMENT";
  if (strongTables.length > 0 && text.includes("bill of quantities")) return "EMBEDDED_BOQ";
  if (strongTables.length > 0 && (text.includes("schedule of rates") || text.includes("unit rate schedule"))) return "RATE_SCHEDULE";
  if (strongTables.length > 0) return "EMBEDDED_PRICING_SCHEDULE";
  if (text.includes("form of offer") || text.includes("tender sum")) return "FORM_OF_OFFER_ONLY";
  if (input.terminologyEvidence.length > 0 || /price|pricing|rate|amount|financial proposal/.test(text)) return "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND";
  if (/no pricing required|no price submission|rates will not be evaluated/.test(text)) return "NO_PRICING_REQUIRED";
  return "MANUAL_REVIEW_REQUIRED";
}

export function fieldFromPattern(documents: DocumentText[], label: string, pattern: RegExp): TenderEvidenceField<string | null> {
  for (const document of documents) {
    const pages = splitPages(document.text, document.pageCount);
    for (let index = 0; index < pages.length; index += 1) {
      const match = pages[index].match(pattern);
      if (match?.[1]?.trim()) {
        return { value: match[1].trim(), evidence: [evidence(document, index + 1, `${label}: ${match[0]}`, 0.78)], confidence: 0.78 };
      }
    }
  }
  return { value: null, evidence: [], confidence: 0 };
}

export function conclusion(label: string, value: string | null | undefined, evidenceItems: TenderSourceEvidence[] = []) {
  return { label, value: value?.trim() || "Not confirmed in analysed documents", evidence: evidenceItems };
}

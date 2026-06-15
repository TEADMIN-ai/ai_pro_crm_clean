import {
  getVehicleFinanceTrainingTemplate,
} from "../datasets";
import type {
  VehicleFinanceTrainingCategory,
  VehicleFinanceTrainingFieldDefinition,
  VehicleFinanceTrainingTemplate,
} from "../types";

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelPattern(aliases: string[]): RegExp {
  return new RegExp(`(?:${aliases.map(escapeRegExp).join("|")})\\s*[:\\-]?\\s*([^\\n\\r]{2,160})`, "i");
}

function firstPatternMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function extractFirstDate(text: string): string {
  const matches = text.match(/\b(?:\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\b/g);
  return matches?.[0] ?? "";
}

function extractFirstMoneyValue(text: string): string {
  const match =
    text.match(/\bR?\s?\d[\d,]*(?:\.\d{2})?\b/) ??
    text.match(/\b\d[\d,]*(?:\.\d{2})?\b/);
  return match?.[0]?.trim() ?? "";
}

function extractFirstLongIdentifier(text: string): string {
  const match = text.match(/\b\d{6,20}\b/);
  return match?.[0] ?? "";
}

function extractNameFallback(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[A-Za-z]/.test(line));

  for (const line of lines) {
    const tokens = line.split(/\s+/).filter((token) => /^[A-Za-z'’-]+$/.test(token));
    if (tokens.length >= 2 && tokens.length <= 4) {
      return tokens.join(" ").trim();
    }
  }

  return "";
}

function extractPeriod(text: string): string {
  const labeled = firstPatternMatch(text, [
    /\b(?:statement period|period)\b\s*[:\-]?\s*([^\n\r]{4,80})/i,
  ]);
  if (labeled) {
    return labeled;
  }

  const matches = text.match(
    /\b(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\s*(?:to|-)\s*(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/i,
  );
  return matches?.[0] ?? "";
}

function extractByKind(text: string, field: VehicleFinanceTrainingFieldDefinition): string {
  const aliases = field.aliases ?? [field.label];
  const labeledValue = firstPatternMatch(text, [
    labelPattern(aliases),
    new RegExp(`(?:${aliases.map(escapeRegExp).join("|")})\\s+([^\\n\\r]{2,160})`, "i"),
  ]);

  if (labeledValue) {
    return labeledValue;
  }

  switch (field.kind) {
    case "date":
      return extractFirstDate(text);
    case "money":
      return extractFirstMoneyValue(text);
    case "identifier":
      return extractFirstLongIdentifier(text);
    case "name":
      return extractNameFallback(text);
    case "period":
      return extractPeriod(text);
    case "text":
    case "number":
    default:
      return "";
  }
}

function scorePresentValues(values: Record<string, string>, requiredFields: string[]): number {
  if (requiredFields.length === 0) {
    return 0;
  }

  const present = requiredFields.filter((field) => (values[field] ?? "").trim().length > 0).length;
  return Math.round((present / requiredFields.length) * 100);
}

export function extractVehicleFinanceTrainingFields(
  category: VehicleFinanceTrainingCategory,
  text: string,
): Record<string, string> {
  const template = getVehicleFinanceTrainingTemplate(category);
  const normalized = normalizeText(text);
  const fields: Record<string, string> = {};

  for (const field of template.fields) {
    fields[field.key] = extractByKind(normalized, field);
  }

  return fields;
}

export function getVehicleFinanceTrainingMissingFields(
  template: VehicleFinanceTrainingTemplate,
  extractedFields: Record<string, string>,
): string[] {
  return template.requiredFields.filter((field) => !(extractedFields[field] ?? "").trim());
}

export function calculateVehicleFinanceTrainingFieldCoverage(
  template: VehicleFinanceTrainingTemplate,
  extractedFields: Record<string, string>,
): number {
  return scorePresentValues(extractedFields, template.requiredFields);
}

export function calculateVehicleFinanceTrainingConfidence(args: {
  template: VehicleFinanceTrainingTemplate;
  extractedFields: Record<string, string>;
  extractedText: string;
}): number {
  const coverageScore = calculateVehicleFinanceTrainingFieldCoverage(args.template, args.extractedFields);
  const volumeScore = Math.min(30, Math.round(args.extractedText.length / 60));
  return Math.max(0, Math.min(100, Math.round(coverageScore * 0.75 + volumeScore)));
}

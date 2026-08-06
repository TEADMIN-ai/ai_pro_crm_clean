import { extractTextFromPdf } from "@/lib/pdf/extractTextFromPdf";
import type { OpportunityExtractionField, OpportunityExtractionResult } from "@/lib/opportunities/opportunityIntake";

function normalizeLine(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = normalizeLine(match?.[1]);
    if (value) return value;
  }
  return "";
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iso = trimmed.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dmy = trimmed.match(/\b(0?[1-9]|[12]\d|3[01])[-/\s](0?[1-9]|1[0-2]|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[-/\s,]+(20\d{2})\b/i);
  if (!dmy) return trimmed;

  const months: Record<string, string> = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
    aug: "08", august: "08", sep: "09", september: "09", oct: "10", october: "10",
    nov: "11", november: "11", dec: "12", december: "12",
  };
  const monthToken = dmy[2].toLowerCase();
  const month = months[monthToken] ?? monthToken.padStart(2, "0");
  return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
}

type ExtractedLabelField = "clientName" | "department";

function sanitizeLabelValue(value: string, field: ExtractedLabelField): string {
  const normalized = normalizeLine(value);
  if (!normalized) return "";
  if (normalized.toUpperCase().includes("CONTACT PERSON")) return "";
  if (/^(?:client|issuer|issuing authority|buyer|department|supply chain)$/i.test(normalized)) return "";
  if (field === "department" && normalized.toLowerCase().startsWith("department:")) return "";
  return normalized;
}

function valueField(value: string, confidence: number, source: string): OpportunityExtractionField | undefined {
  const normalized = normalizeLine(value);
  return normalized ? { value: normalized, confidence, source } : undefined;
}

export async function extractOpportunityMetadataFromPdf(input: {
  fileName: string;
  buffer: Buffer | Uint8Array;
  extractionId?: string;
}): Promise<OpportunityExtractionResult> {
  const extractedText = await extractTextFromPdf(input.buffer);
  const title =
    firstMatch(extractedText, [
      /(?:request for quotation|request for proposal|bid description|tender description|description)[:\s-]+([^\n]{8,180})/i,
      /(?:appointment of|supply and delivery of|provision of|rendering of)\s+([^\n]{8,180})/i,
    ]) || input.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const referenceNumber = firstMatch(extractedText, [
    /(?:rfq|rfp|bid|tender|quotation)\s*(?:number|no\.?|ref(?:erence)?\.?)[:\s-]*([A-Z0-9/-]{3,})/i,
    /\b((?:RFQ|RFP|BID|TENDER)[-/\s]?[A-Z0-9/-]{3,})\b/i,
  ]);
  const clientName = firstMatch(extractedText, [
    /(?:issued by|issuing authority|buyer|client|municipality|department)[:\s-]+([^\n]{4,140})/i,
  ]);
  const municipality = firstMatch(extractedText, [
    /(?:municipality)[:\s-]+([^\n]{4,120})/i,
    /\b([A-Z][A-Za-z\s'-]+ Municipality)\b/,
  ]);
  const department = firstMatch(extractedText, [
    /(?:department)[:\s-]+([^\n]{4,120})/i,
    /\bDepartment of ([A-Za-z\s&-]{4,100})\b/i,
  ]);
  const closingRaw = firstMatch(extractedText, [
    /(?:closing date|closing time|submission deadline|deadline)[:\s-]+([^\n]{6,80})/i,
  ]);
  const estimatedValue = firstMatch(extractedText, [
    /(?:estimated value|contract value|tender value|budget)[:\s-]*R?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const province = firstMatch(extractedText, [
    /(?:province)[:\s-]+([^\n]{4,80})/i,
    /\b(Gauteng|Western Cape|Eastern Cape|Northern Cape|KwaZulu-Natal|Free State|Limpopo|Mpumalanga|North West)\b/i,
  ]);

  const fields: OpportunityExtractionResult["fields"] = {};
  const mappings = {
    referenceNumber: valueField(referenceNumber, 0.86, "RFQ/RFP reference pattern"),
    opportunityTitle: valueField(title, title === input.fileName ? 0.45 : 0.76, "document title/description"),
    clientName: valueField(sanitizeLabelValue(clientName, "clientName"), 0.72, "issuer/client label"),
    municipality: valueField(municipality, 0.7, "municipality label"),
    department: valueField(sanitizeLabelValue(department, "department"), 0.68, "department label"),
    closingDate: valueField(normalizeDate(closingRaw), 0.78, "closing date label"),
    estimatedValue: valueField(estimatedValue ? estimatedValue.replace(/,/g, "") : "", 0.72, "estimated value label"),
    province: valueField(province, 0.62, "province label"),
    description: valueField(title, 0.58, "document title/description"),
  };

  for (const [key, field] of Object.entries(mappings)) {
    if (field) fields[key as keyof typeof fields] = field;
  }

  return {
    extractionId: input.extractionId,
    fields,
    extractedText,
    documentName: input.fileName,
    analyzedAt: new Date().toISOString(),
  };
}

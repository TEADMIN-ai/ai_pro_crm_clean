import type {
  TenderDocumentAnalysis,
  TenderExtractedLineItem,
  TenderIntelligence,
  TenderPricingTableCandidate,
  TenderSourceEvidence,
  TenderSummaryConclusion,
} from "@/types/tenderIntelligence";
import {
  classifyPricing,
  classifyTenderDocument,
  conclusion,
  detectPricingTables,
  detectPricingTerminology,
  extractLineItems,
  fieldFromPattern,
  hashDocumentText,
} from "./detection";
import { buildDetailedSubmissionSummary, buildExecutiveSummary } from "./summaries";

export type TenderDocumentTextInput = {
  documentId: string;
  filename: string;
  storagePath: string | null;
  text: string;
  pageCount: number;
  extractionSource: "PDF_TEXT" | "OCR" | "EMPTY" | "MANUAL" | "UNAVAILABLE";
  extractionStatus?: TenderDocumentAnalysis["extractionStatus"];
};

type BuildTenderIntelligenceInput = {
  id: string;
  workspaceId: string | null;
  opportunityId: string;
  dealId: string;
  documents: TenderDocumentTextInput[];
  existing?: TenderIntelligence | null;
  nowIso?: string;
};

function evidenceConclusion(label: string, value: string | null, evidence: TenderSourceEvidence[]): TenderSummaryConclusion {
  return conclusion(label, value, evidence);
}

function extractListFromPatterns(documents: TenderDocumentTextInput[], label: string, patterns: RegExp[]): TenderSummaryConclusion[] {
  const conclusions: TenderSummaryConclusion[] = [];
  for (const pattern of patterns) {
    const field = fieldFromPattern(documents, label, pattern);
    if (field.value) conclusions.push(evidenceConclusion(label, field.value, field.evidence));
  }
  return dedupeConclusions(conclusions);
}

function dedupeConclusions(items: TenderSummaryConclusion[]): TenderSummaryConclusion[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}:${item.value}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function boolFromText(text: string, yesPattern: RegExp, noPattern?: RegExp): boolean | null {
  if (yesPattern.test(text)) return true;
  if (noPattern?.test(text)) return false;
  return null;
}

function confidenceFor(input: {
  fieldsWithEvidence: number;
  documentCount: number;
  pricingTables: TenderPricingTableCandidate[];
  lineItems: TenderExtractedLineItem[];
}): number {
  const tableScore = input.pricingTables.length ? Math.min(0.2, input.pricingTables.length * 0.03) : 0;
  const lineScore = input.lineItems.length ? 0.12 : 0;
  const fieldScore = Math.min(0.5, input.fieldsWithEvidence * 0.045);
  const documentScore = Math.min(0.12, input.documentCount * 0.03);
  const lowConfidencePenalty = input.lineItems.some((item) => item.reviewStatus === "REVIEW_REQUIRED") ? 0.08 : 0;
  return Math.max(0.2, Math.min(0.96, Number((0.18 + tableScore + lineScore + fieldScore + documentScore - lowConfidencePenalty).toFixed(2))));
}

function boqLocation(pricingTables: TenderPricingTableCandidate[], documents: TenderDocumentTextInput[]): string | null {
  if (!pricingTables.length) return null;
  const byDocument = new Map<string, number[]>();
  for (const table of pricingTables) {
    const pages = byDocument.get(table.sourceDocumentId) ?? [];
    pages.push(table.sourcePage);
    byDocument.set(table.sourceDocumentId, pages);
  }
  return [...byDocument.entries()]
    .map(([documentId, pages]) => {
      const doc = documents.find((candidate) => candidate.documentId === documentId);
      const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
      return `${doc?.filename ?? documentId} pages ${sorted[0]}-${sorted[sorted.length - 1]}`;
    })
    .join("; ");
}

export function buildTenderIntelligence(input: BuildTenderIntelligenceInput): TenderIntelligence {
  const now = input.nowIso ?? new Date().toISOString();
  const fullText = input.documents.map((document) => document.text).join("\n\n");
  const documentAnalyses: TenderDocumentAnalysis[] = input.documents.map((document) => {
    const documentHash = hashDocumentText(document.text);
    const previous = input.existing?.documentAnalyses.find((candidate) => candidate.documentId === document.documentId);
    return {
      documentId: document.documentId,
      filename: document.filename,
      documentCategory: classifyTenderDocument(document.filename, document.text),
      storagePath: document.storagePath,
      documentHash,
      pageCount: document.pageCount,
      extractionStatus: document.extractionStatus ?? (document.extractionSource === "OCR" ? "OCR_USED" : document.text.trim() ? "EXTRACTED" : "EMPTY"),
      analysisStatus: "ANALYSED",
      amendmentStatus: previous && previous.documentHash !== documentHash ? "AMENDED" : previous?.amendmentStatus ?? "ORIGINAL",
      textLength: document.text.length,
      extractionSource: document.extractionSource,
    };
  });
  const terminologyEvidence = detectPricingTerminology(input.documents);
  const pricingTables = detectPricingTables(input.documents);
  const extractedLineItems = extractLineItems(pricingTables);
  let pricingClassification = classifyPricing({ documentAnalyses, terminologyEvidence, pricingTables, fullText });
  const normalizedFullText = fullText.toLowerCase();
  if (/no pricing required|no price submission|rates will not be evaluated/.test(normalizedFullText)) pricingClassification = "NO_PRICING_REQUIRED";
  if (/template will be issued separately|pricing template will be issued|price schedule will be issued|pricing template.+separately/.test(normalizedFullText)) pricingClassification = "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND";

  const tenderNumber = fieldFromPattern(input.documents, "Tender number", /(?:tender|bid|rfq|rfp)\s*(?:number|no\.?|#)?[:\s-]*([A-Z0-9/-]{4,})/i);
  const title = fieldFromPattern(input.documents, "Tender title", /(?:description|bid description|tender title|project title)[:\s-]+([^\n]{8,220})/i);
  const issuer = fieldFromPattern(input.documents, "Issuer", /(?:issued by|issuer|institution|organ of state)[:\s-]+([^\n]{4,160})/i);
  const department = fieldFromPattern(input.documents, "Department", /(?:department)[:\s-]+([^\n]{4,140})/i);
  const municipality = fieldFromPattern(input.documents, "Municipality", /(?:municipality)[:\s-]+([^\n]{4,140})/i);
  const province = fieldFromPattern(input.documents, "Province", /\b(Eastern Cape|Free State|Gauteng|KwaZulu-Natal|Limpopo|Mpumalanga|Northern Cape|North West|Western Cape|National)\b/i);
  const advertisedAt = fieldFromPattern(input.documents, "Advertised date", /(?:advertised|publication date|published)[:\s-]+([^\n]{6,80})/i);
  const closingAt = fieldFromPattern(input.documents, "Closing date", /(?:closing date|closing time|submission deadline|deadline)[:\s-]+([^\n]{6,100})/i);
  const briefingDate = fieldFromPattern(input.documents, "Briefing date", /(?:briefing|site meeting)[^\n:]*[:\s-]+([^\n]{6,120})/i);
  const briefingLocation = fieldFromPattern(input.documents, "Briefing location", /(?:briefing venue|briefing location|site meeting venue)[:\s-]+([^\n]{4,160})/i);
  const submissionMethod = fieldFromPattern(input.documents, "Submission method", /(?:submission method|submit(?:ted)? via|delivery of bid)[:\s-]+([^\n]{4,160})/i);
  const submissionAddress = fieldFromPattern(input.documents, "Submission address", /(?:submission address|bid box|tender box|delivered to)[:\s-]+([^\n]{4,220})/i);
  const contactName = fieldFromPattern(input.documents, "Contact name", /(?:contact person|enquiries)[:\s-]+([A-Z][^\n@]{3,100})/i);
  const contactEmail = fieldFromPattern(input.documents, "Contact email", /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const contactPhone = fieldFromPattern(input.documents, "Contact phone", /(?:tel|telephone|phone|cell)[:\s-]+([+0-9 ()-]{7,30})/i);
  const deliveryLocation = fieldFromPattern(input.documents, "Delivery location", /(?:delivery location|place of delivery|site location|service location)[:\s-]+([^\n]{4,180})/i);
  const deliveryDeadline = fieldFromPattern(input.documents, "Delivery deadline", /(?:delivery deadline|completion date|required by)[:\s-]+([^\n]{4,120})/i);
  const contractDuration = fieldFromPattern(input.documents, "Contract duration", /(?:contract duration|period of contract|duration)[:\s-]+([^\n]{3,100})/i);
  const estimatedValueRaw = fieldFromPattern(input.documents, "Estimated value", /(?:estimated value|contract value|budget)[:\s-]*R?\s*([\d ,]+(?:\.\d{2})?)/i);
  const estimatedValue = estimatedValueRaw.value ? Number(estimatedValueRaw.value.replace(/[^0-9.]+/g, "")) : null;

  const eligibilityRequirements = extractListFromPatterns(input.documents, "Eligibility requirement", [
    /(?:eligibility requirements?|minimum requirements?)[:\s-]+([^\n]{6,220})/i,
    /(cidb\s*(?:grading|class)[^\n]{3,160})/i,
  ]);
  const compulsoryCompliance = extractListFromPatterns(input.documents, "Compulsory compliance", [
    /(tax compliance[^\n]{0,160})/i,
    /(central supplier database|csd[^\n]{0,160})/i,
    /(b[-\s]?bbbee[^\n]{0,160})/i,
    /(coida|compensation fund[^\n]{0,160})/i,
  ]);
  const requiredReturnables = extractListFromPatterns(input.documents, "Required returnable", [
    /(?:returnable documents?|compulsory returnables?)[:\s-]+([^\n]{6,260})/i,
    /(sbd\s*\d[^\n]{0,160})/i,
    /(form of offer[^\n]{0,160})/i,
  ]);
  const evaluationCriteria = extractListFromPatterns(input.documents, "Evaluation criteria", [
    /(?:evaluation criteria|evaluation methodology)[:\s-]+([^\n]{6,260})/i,
    /(\b80\/20\b|\b90\/10\b[^\n]{0,140})/i,
  ]);
  const functionalityCriteria = extractListFromPatterns(input.documents, "Functionality criteria", [
    /(?:functionality criteria|technical evaluation)[:\s-]+([^\n]{6,260})/i,
  ]);
  const preferencePointSystemField = fieldFromPattern(input.documents, "Preference point system", /\b(80\/20|90\/10)\b[^\n]*/i);
  const disqualificationRisks = extractListFromPatterns(input.documents, "Disqualification risk", [
    /(?:disqualification|will be disqualified|non[-\s]?responsive)[:\s-]*([^\n]{6,240})/i,
    /(late submissions?[^\n]{0,160})/i,
  ]);
  const signaturesRequired = extractListFromPatterns(input.documents, "Signature required", [
    /(sign(?:ed|ature)[^\n]{0,180})/i,
  ]);

  const sourceEvidence = [
    ...tenderNumber.evidence,
    ...title.evidence,
    ...issuer.evidence,
    ...closingAt.evidence,
    ...deliveryLocation.evidence,
    ...terminologyEvidence,
  ];
  const unresolvedQuestions: TenderSummaryConclusion[] = [];
  if (!closingAt.value) unresolvedQuestions.push(conclusion("Closing date unresolved", "Confirm closing date and time before submission"));
  if (pricingClassification === "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND") unresolvedQuestions.push(conclusion("Pricing template missing", "Pricing requirement detected but no usable table/template was found", terminologyEvidence));
  if (extractedLineItems.some((item) => item.reviewStatus === "REVIEW_REQUIRED")) unresolvedQuestions.push(conclusion("Low-confidence line items", "Review extracted pricing rows before handoff"));

  const fieldsWithEvidence = [
    tenderNumber,
    title,
    issuer,
    closingAt,
    briefingDate,
    submissionMethod,
    deliveryLocation,
    estimatedValueRaw,
  ].filter((field) => field.evidence.length > 0).length;

  const pricingRequirement = pricingClassification === "NO_PRICING_REQUIRED"
    ? "No pricing requirement detected"
    : pricingClassification === "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"
      ? "Pricing is required, but no usable pricing template was found"
      : `Pricing detected as ${pricingClassification.replace(/_/g, " ").toLowerCase()}`;

  const briefingRequired = boolFromText(fullText, /briefing|site meeting/i, /no briefing/i);
  const briefingCompulsory = boolFromText(fullText, /compulsory (?:briefing|site meeting)|mandatory (?:briefing|site meeting)/i, /non[-\s]?compulsory briefing|briefing is not compulsory/i);
  const intelligenceBase: Omit<TenderIntelligence, "executiveSummary" | "detailedSubmissionSummary"> = {
    id: input.id,
    workspaceId: input.workspaceId,
    opportunityId: input.opportunityId,
    dealId: input.dealId,
    sourceDocumentIds: input.documents.map((document) => document.documentId),
    tenderNumber: tenderNumber.value,
    title: title.value,
    issuer: issuer.value,
    department: department.value,
    municipality: municipality.value,
    organOfState: issuer.value,
    province: province.value,
    advertisedAt: advertisedAt.value,
    closingAt: closingAt.value,
    briefingDate: briefingDate.value,
    briefingLocation: briefingLocation.value,
    briefingRequired,
    briefingCompulsory,
    submissionMethod: submissionMethod.value,
    submissionAddress: submissionAddress.value,
    contactName: contactName.value,
    contactEmail: contactEmail.value,
    contactPhone: contactPhone.value,
    serviceCategory: null,
    scopeSummary: title.value,
    detailedScope: title.value ?? (fullText.slice(0, 900).replace(/\s+/g, " ").trim() || null),
    deliveryLocation: deliveryLocation.value,
    deliveryDeadline: deliveryDeadline.value,
    contractDuration: contractDuration.value,
    estimatedValue: Number.isFinite(estimatedValue ?? NaN) ? estimatedValue : null,
    eligibilityRequirements,
    compulsoryCompliance,
    requiredReturnables,
    evaluationCriteria,
    functionalityCriteria,
    preferencePointSystem: preferencePointSystemField.value,
    disqualificationRisks,
    signaturesRequired,
    pricingRequirement,
    boqClassification: pricingClassification,
    extractedLineItems,
    unresolvedQuestions,
    analysisConfidence: confidenceFor({ fieldsWithEvidence, documentCount: input.documents.length, pricingTables, lineItems: extractedLineItems }),
    reviewStatus: "REVIEW_REQUIRED",
    analysisStatus: "REVIEW_REQUIRED",
    approvedBy: null,
    approvedAt: null,
    documentAnalyses,
    pricingTables,
    sourceEvidence,
    amendmentOfIntelligenceId: input.existing?.analysisStatus === "APPROVED" ? input.existing.id : input.existing?.amendmentOfIntelligenceId ?? null,
    supersededByIntelligenceId: null,
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };

  const executiveSummary = buildExecutiveSummary({
    title: intelligenceBase.scopeSummary,
    issuer: intelligenceBase.issuer,
    closingAt: intelligenceBase.closingAt,
    deliveryLocation: intelligenceBase.deliveryLocation,
    briefingCompulsory: intelligenceBase.briefingCompulsory,
    eligibilityRequirements,
    compulsoryCompliance,
    pricingRequirement,
    boqLocation: boqLocation(pricingTables, input.documents),
    disqualificationRisks,
    nextAction: unresolvedQuestions.length ? "Resolve unresolved tender intelligence items" : "Review and approve tender intelligence",
  });
  const detailedSubmissionSummary = buildDetailedSubmissionSummary({ ...intelligenceBase, executiveSummary: [] } as TenderIntelligence);

  return {
    ...intelligenceBase,
    executiveSummary,
    detailedSubmissionSummary,
  };
}




import { createHash } from "crypto";
import { getEtendersSectorPreset } from "@/lib/etenders/presets";
import {
  ETENDERS_SOURCE_SYSTEM,
  type EtendersDocumentKind,
  type EtendersDocumentLink,
  type EtendersSearchFilters,
  type EtendersSourceRecord,
  type EtendersSourceStatus,
} from "@/lib/etenders/types";

const SOURCE_BASE_URL = "https://www.etenders.gov.za";
const OPPORTUNITY_PAGE_PATH = "/Home/opportunities?id=1";
const PUBLIC_DOCUMENT_CANDIDATE_PATH = "/Home/Download";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value: unknown): EtendersSourceStatus {
  const normalized = (asString(value) ?? "").toLowerCase();
  if (normalized.includes("publish")) return "PUBLISHED";
  if (normalized.includes("award")) return "AWARDED";
  if (normalized.includes("cancel")) return "CANCELLED";
  if (normalized.includes("closed")) return "CLOSED";
  return "UNKNOWN";
}

function inferDocumentKind(fileName: string): EtendersDocumentKind {
  const lower = fileName.toLowerCase();
  if (/\bboq\b|bill of quantities|pricing schedule|price schedule/.test(lower)) {
    return lower.includes("boq") || lower.includes("bill of quantities") ? "BOQ" : "PRICING_SCHEDULE";
  }
  if (/amend|addendum|corrigendum/.test(lower)) return "AMENDMENT";
  if (/brief/.test(lower)) return "BRIEFING_DOCUMENT";
  if (/returnable|sbd|standard bidding/.test(lower)) return "RETURNABLE_SCHEDULE";
  if (/rfq|rfp|invitation|bid|terms of reference|tor/.test(lower)) return "RFQ_RFP_NOTICE";
  if (/annex|appendix/.test(lower)) return "ANNEXURE";
  return "SUPPORTING";
}

export function buildEtendersSourceUrl(sourceOpportunityId: string): string {
  return `${SOURCE_BASE_URL}${OPPORTUNITY_PAGE_PATH}#tender-${encodeURIComponent(sourceOpportunityId)}`;
}

export function buildEtendersDocumentCandidateUrl(sourceDocumentId: string): string {
  return `${SOURCE_BASE_URL}${PUBLIC_DOCUMENT_CANDIDATE_PATH}?blobName=${encodeURIComponent(sourceDocumentId)}`;
}

export function normalizeEtendersDocument(document: unknown): EtendersDocumentLink | null {
  const source = asRecord(document);
  const sourceDocumentId = asString(source.supportDocumentID ?? source.id ?? source.documentId);
  const fileName = asString(source.fileName ?? source.name);
  if (!sourceDocumentId || !fileName) return null;

  const kind = inferDocumentKind(fileName);
  return {
    id: sourceDocumentId,
    sourceDocumentId,
    fileName,
    extension: asString(source.extension),
    url: buildEtendersDocumentCandidateUrl(sourceDocumentId),
    kind,
    active: source.active !== false,
    dateModified: asString(source.dateModified),
  };
}

function extractRequirements(raw: Record<string, unknown>): string[] {
  return [raw.conditions, raw.briefingCompulsory === true ? "Compulsory briefing" : null]
    .map(asString)
    .filter((value): value is string => Boolean(value && value.toLowerCase() !== "n/a"));
}

function extractCidbRequirements(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/\b\d{1,2}\s?(?:GB|CE|ME|EP|EB|SB|SQ|SO|SN|SH|SC|SK|SL|SM|SF)\b/gi);
  return matches ? Array.from(new Set(matches.map((item) => item.toUpperCase().replace(/\s+/g, "")))) : [];
}

export function generateEtendersSourceFingerprint(input: Pick<EtendersSourceRecord, "sourceSystem" | "sourceOpportunityId" | "tenderNumber" | "organOfState" | "closingAt" | "documentLinks" | "sourceStatus">): string {
  const material = {
    sourceSystem: input.sourceSystem,
    sourceOpportunityId: input.sourceOpportunityId,
    tenderNumber: input.tenderNumber,
    organOfState: input.organOfState,
    closingAt: input.closingAt,
    sourceStatus: input.sourceStatus,
    documents: input.documentLinks.map((document) => ({
      id: document.sourceDocumentId,
      fileName: document.fileName,
      dateModified: document.dateModified ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

export function normalizeEtendersOpportunity(rawValue: unknown, checkedAt = new Date().toISOString()): EtendersSourceRecord {
  const raw = asRecord(rawValue);
  const sourceOpportunityId = String(raw.id ?? raw.tendersID ?? raw.tenderId ?? "").trim();
  if (!sourceOpportunityId) {
    throw new Error("eTenders source record is missing id");
  }

  const tenderNumber = asString(raw.tender_No ?? raw.tenderNumber);
  const description = asString(raw.description);
  const documents = Array.isArray(raw.supportDocument)
    ? raw.supportDocument.map(normalizeEtendersDocument).filter((item): item is EtendersDocumentLink => Boolean(item))
    : [];
  const title = description ?? tenderNumber ?? `eTenders opportunity ${sourceOpportunityId}`;
  const sourceStatus = normalizeStatus(raw.status);
  const recordWithoutFingerprint = {
    sourceSystem: ETENDERS_SOURCE_SYSTEM,
    sourceOpportunityId,
    sourceUrl: buildEtendersSourceUrl(sourceOpportunityId),
    tenderNumber,
    tenderType: asString(raw.type),
    title,
    description,
    category: asString(raw.category ?? asRecord(raw.categories).name),
    organOfState: asString(raw.organ_of_State ?? asRecord(raw.departments).name),
    department: asString(raw.department ?? asRecord(raw.departments).name),
    municipality: asString(raw.town ?? raw.municipality),
    province: asString(raw.province ?? asRecord(raw.provinces).name),
    advertisedAt: asString(raw.date_Published),
    closingAt: asString(raw.closing_Date),
    briefingDate: asString(raw.compulsory_briefing_session),
    briefingRequired: asBoolean(raw.briefingSession),
    briefingCompulsory: asBoolean(raw.briefingCompulsory),
    submissionMethod: asBoolean(raw.eSubmission) ? "eSubmission" : "Physical or issuer-specified",
    eSubmissionAccepted: asBoolean(raw.eSubmission),
    contactName: asString(raw.contactPerson),
    contactEmail: asString(raw.email),
    contactPhone: asString(raw.telephone),
    estimatedValue: parseNumber(raw.estimatedValue),
    cidbRequirements: extractCidbRequirements([description, raw.conditions].map(asString).filter(Boolean).join(" ")),
    compulsoryRequirements: extractRequirements(raw),
    documentLinks: documents,
    amendmentLinks: documents.filter((document) => document.kind === "AMENDMENT"),
    sourceStatus,
    workflowState: sourceStatus === "CANCELLED" ? "CANCELLED" : sourceStatus === "CLOSED" ? "CLOSED" : "DISCOVERED",
    lastSourceCheckedAt: checkedAt,
    sourceFingerprint: "",
    rawSourceMetadata: {
      id: raw.id,
      tender_No: raw.tender_No,
      type: raw.type,
      status: raw.status,
      categoriesID: raw.categoriesID,
      provincesID: raw.provincesID,
      departmentsID: raw.departmentsID,
      eSubmission: raw.eSubmission,
      supportDocument: documents.map((document) => ({
        sourceDocumentId: document.sourceDocumentId,
        fileName: document.fileName,
        extension: document.extension,
        dateModified: document.dateModified,
        active: document.active,
      })),
    },
  } satisfies EtendersSourceRecord;

  return {
    ...recordWithoutFingerprint,
    sourceFingerprint: generateEtendersSourceFingerprint(recordWithoutFingerprint),
  };
}

export function mapEtendersFiltersToDataTables(filters: EtendersSearchFilters = {}) {
  const preset = getEtendersSectorPreset(filters.preset);
  const keywordParts = [filters.keywords, ...(preset?.keywords ?? [])].filter(Boolean);
  return {
    status: 1,
    search: { value: keywordParts.join(" ").trim(), regex: false },
    tenderNumber: filters.tenderNumber?.trim() || undefined,
    categories: filters.category || preset?.categories.join(",") || undefined,
    provinces: filters.province || undefined,
    departments: filters.organOfState || undefined,
    requestType: filters.tenderType || undefined,
    eSubmission: typeof filters.eSubmissionAccepted === "boolean" ? String(filters.eSubmissionAccepted) : undefined,
  };
}

export function filterNormalizedEtendersRecords(records: EtendersSourceRecord[], filters: EtendersSearchFilters = {}) {
  const preset = getEtendersSectorPreset(filters.preset);
  const keywords = [filters.keywords, ...(preset?.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
  const categories = new Set([filters.category, ...(preset?.categories ?? [])].filter(Boolean).map((item) => item?.toLowerCase()));
  const inRange = (value: string | null, from?: string, to?: string) => {
    if (!value) return true;
    const time = new Date(value).getTime();
    if (from && time < new Date(from).getTime()) return false;
    if (to && time > new Date(to).getTime()) return false;
    return true;
  };

  return records.filter((record) => {
    const haystack = [record.tenderNumber, record.title, record.description, record.organOfState, record.department, record.category, record.province].join(" ").toLowerCase();
    return (
      (!keywords || keywords.split(/\s+/).some((term) => haystack.includes(term))) &&
      (!filters.tenderNumber || (record.tenderNumber ?? "").toLowerCase().includes(filters.tenderNumber.toLowerCase())) &&
      (!categories.size || categories.has((record.category ?? "").toLowerCase())) &&
      (!filters.province || record.province === filters.province) &&
      (!filters.organOfState || record.organOfState === filters.organOfState || record.department === filters.organOfState) &&
      (!filters.tenderType || record.tenderType === filters.tenderType) &&
      (typeof filters.eSubmissionAccepted !== "boolean" || record.eSubmissionAccepted === filters.eSubmissionAccepted) &&
      inRange(record.advertisedAt, filters.advertisedFrom, filters.advertisedTo) &&
      inRange(record.closingAt, filters.closingFrom, filters.closingTo)
    );
  });
}


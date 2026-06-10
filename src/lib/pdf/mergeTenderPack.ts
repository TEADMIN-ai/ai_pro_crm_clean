import { PDFDocument } from "pdf-lib";
import { fillSbd1 } from "@/lib/empirePdf/fillSbd1";
import { fillSbd4 } from "@/lib/empirePdf/fillSbd4";
import { generateTenderPdf } from "@/lib/pdf/generateTenderPdf";

type MergedPackDealSource = Record<string, unknown> & {
  id: string;
};

type MergedPackContractorSource = Record<string, unknown> & {
  id: string;
};

type TenderDealData = {
  id: string;
  title: string;
  value: number | null;
  readinessScore: number | null;
  missingDocs: string[];
  missingRequirements?: string[];
  riskLevel: string | null;
  riskGrade?: string | null;
  tenderLockStatus?: string | null;
  complianceApproved?: boolean | null;
  suggestions: string[];
  status?: string | null;
  compliance?: TenderPackComplianceInput | null;
  intelligence?: TenderPackComplianceInput["intelligence"] | null;
};

type TenderContractorData = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  companyRegistrationNumber?: string | null;
  csdNumber?: string | null;
  bbbeeStatus: string | null;
  contactPerson?: string | null;
  contactName?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  telephone?: string | null;
  directorName?: string | null;
  readinessScore?: number | null;
  tenderLockStatus?: string | null;
  complianceApproved?: boolean | null;
  riskGrade?: string | null;
  docsMissing?: number | null;
  missingDocumentTypes?: string[] | null;
  missingCriticalDocuments?: string[] | null;
  explainableSummary?: string | null;
  blockedReasons?: string[] | null;
  reviewRecommendations?: string[] | null;
  complianceDocumentBreakdown?: TenderPackComplianceInput["intelligence"]["documentBreakdown"];
  documents?: TenderPackComplianceInput["legacyDocuments"] | null;
};

type TenderPackComplianceInput = {
  readinessScore?: number | null;
  tenderLockStatus?: string | null;
  complianceApproved?: boolean | null;
  riskGrade?: string | null;
  docsMissing?: number | null;
  missingDocumentTypes?: string[] | null;
  expiredDocumentCount?: number | null;
  legacyDocuments?: Record<string, { valid?: boolean; uploaded?: boolean; status?: string; documentType?: string }> | null;
  intelligence: {
    riskGrade?: string | null;
    explainableSummary?: string | null;
    blockedReasons?: string[] | null;
    reviewRecommendations?: string[] | null;
    documentBreakdown?: Array<{
      documentType?: string;
      label?: string;
      status?: string;
      reason?: string | null;
      suggestions?: string[];
    }> | null;
  };
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown): string | null {
  const normalized = getString(value);
  return normalized.length > 0 ? normalized : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeDealData(deal: MergedPackDealSource): TenderDealData {
  return {
    id: deal.id,
    title: getString(deal.title) || getString(deal.name) || deal.id,
    value: getNumber(deal.value),
    readinessScore: getNumber(deal.readinessScore),
    missingDocs: getStringArray(deal.missingDocs).length > 0
      ? getStringArray(deal.missingDocs)
      : getStringArray(deal.missingRequirements),
    missingRequirements: getStringArray(deal.missingRequirements),
    riskLevel: getString(deal.riskLevel) || null,
    riskGrade: getOptionalString(deal.riskGrade),
    tenderLockStatus: getOptionalString(deal.tenderLockStatus),
    complianceApproved: typeof deal.complianceApproved === "boolean" ? deal.complianceApproved : null,
    suggestions: getStringArray(deal.suggestions),
    status: getOptionalString(deal.status),
  };
}

function normalizeContractorData(contractor: MergedPackContractorSource): TenderContractorData {
  return {
    id: contractor.id,
    companyName:
      getString(contractor.companyName) ||
      getString(contractor.company) ||
      getString(contractor.name) ||
      contractor.id,
    registrationNumber:
      getOptionalString(contractor.registrationNumber) ??
      getOptionalString(contractor.companyRegistrationNumber),
    companyRegistrationNumber:
      getOptionalString(contractor.companyRegistrationNumber),
    csdNumber:
      getOptionalString(contractor.csdNumber) ??
      getOptionalString(contractor.csdRegistrationNumber),
    bbbeeStatus:
      getOptionalString(contractor.bbbeeStatus) ??
      getOptionalString(contractor.bbbeeLevel) ??
      getOptionalString(contractor.bbbee),
    contactPerson:
      getOptionalString(contractor.contactPerson) ??
      getOptionalString(contractor.contactName),
    contactName:
      getOptionalString(contractor.contactName),
    email:
      getOptionalString(contractor.email) ??
      getOptionalString(contractor.contactEmail),
    contactEmail:
      getOptionalString(contractor.contactEmail),
    phone:
      getOptionalString(contractor.phone) ??
      getOptionalString(contractor.contactPhone),
    contactPhone:
      getOptionalString(contractor.contactPhone),
    telephone:
      getOptionalString(contractor.telephone),
    directorName:
      getOptionalString(contractor.directorName) ??
      getOptionalString(contractor.contactPerson) ??
      getOptionalString(contractor.contactName),
    readinessScore: getNumber(contractor.readinessScore),
    tenderLockStatus: getOptionalString(contractor.tenderLockStatus),
    complianceApproved: typeof contractor.complianceApproved === "boolean" ? contractor.complianceApproved : null,
    riskGrade: getOptionalString(contractor.riskGrade),
    docsMissing: getNumber(contractor.docsMissing),
    missingDocumentTypes: getStringArray(contractor.missingDocumentTypes),
    missingCriticalDocuments: getStringArray(contractor.missingCriticalDocuments),
    explainableSummary: getOptionalString(contractor.explainableSummary),
    blockedReasons: getStringArray(contractor.blockedReasons),
    reviewRecommendations: getStringArray(contractor.reviewRecommendations),
    complianceDocumentBreakdown: Array.isArray(contractor.complianceDocumentBreakdown)
      ? contractor.complianceDocumentBreakdown as TenderPackComplianceInput["intelligence"]["documentBreakdown"]
      : null,
    documents: contractor.documents && typeof contractor.documents === "object"
      ? contractor.documents as TenderPackComplianceInput["legacyDocuments"]
      : null,
  };
}

export async function mergeTenderPack(
  summaryBytes: Uint8Array,
  sbd1Bytes: Uint8Array,
  sbd4Bytes: Uint8Array,
  supportingDocs: Uint8Array[] = [],
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  const summaryPdf = await PDFDocument.load(summaryBytes);
  const sbd1Pdf = await PDFDocument.load(sbd1Bytes);
  const sbd4Pdf = await PDFDocument.load(sbd4Bytes);

  const summaryPages = await mergedPdf.copyPages(
    summaryPdf,
    summaryPdf.getPageIndices()
  );

  summaryPages.forEach((page) => mergedPdf.addPage(page));

  const sbdPages = await mergedPdf.copyPages(
    sbd1Pdf,
    sbd1Pdf.getPageIndices()
  );

  sbdPages.forEach((page) => mergedPdf.addPage(page));

  const sbd4Pages = await mergedPdf.copyPages(
    sbd4Pdf,
    sbd4Pdf.getPageIndices()
  );

  sbd4Pages.forEach((page) => mergedPdf.addPage(page));

  for (const supportingDocBytes of supportingDocs) {
    const supportingPdf = await PDFDocument.load(supportingDocBytes);
    const supportingPages = await mergedPdf.copyPages(
      supportingPdf,
      supportingPdf.getPageIndices()
    );

    supportingPages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf.save();
}

export function getMergedPackTemplateIds(_deal: MergedPackDealSource): string[] {
  return ["summary", "sbd1", "sbd4"];
}

export async function generateMergedPack(
  deal: MergedPackDealSource,
  contractor: MergedPackContractorSource,
  compliance?: TenderPackComplianceInput | null,
): Promise<Uint8Array> {
  const normalizedDeal = {
    ...normalizeDealData(deal),
    compliance: compliance ?? null,
    intelligence: compliance?.intelligence ?? null,
  };
  const normalizedContractor = normalizeContractorData(contractor);

  const summaryBytes = await generateTenderPdf(normalizedDeal, normalizedContractor);
  const sbd1Bytes = await fillSbd1(normalizedContractor, normalizedDeal);
  const sbd4Bytes = await fillSbd4(normalizedContractor, normalizedDeal);

  return mergeTenderPack(summaryBytes, sbd1Bytes, sbd4Bytes);
}

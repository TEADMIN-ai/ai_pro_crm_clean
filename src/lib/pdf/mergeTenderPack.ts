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
  readinessScore: number;
  missingDocs: string[];
  riskLevel: string;
  suggestions: string[];
};

type TenderContractorData = {
  id: string;
  companyName: string;
  registrationNumber: string | null;
  bbbeeStatus: string | null;
  contactPerson?: string | null;
  directorName?: string | null;
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
    readinessScore: getNumber(deal.readinessScore) ?? 0,
    missingDocs: getStringArray(deal.missingDocs),
    riskLevel: getString(deal.riskLevel) || "LOW",
    suggestions: getStringArray(deal.suggestions),
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
    bbbeeStatus:
      getOptionalString(contractor.bbbeeStatus) ??
      getOptionalString(contractor.bbbeeLevel) ??
      getOptionalString(contractor.bbbee),
    contactPerson:
      getOptionalString(contractor.contactPerson) ??
      getOptionalString(contractor.contactName),
    directorName:
      getOptionalString(contractor.directorName) ??
      getOptionalString(contractor.contactPerson) ??
      getOptionalString(contractor.contactName),
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
): Promise<Uint8Array> {
  const normalizedDeal = normalizeDealData(deal);
  const normalizedContractor = normalizeContractorData(contractor);

  const summaryBytes = await generateTenderPdf(normalizedDeal, normalizedContractor);
  const sbd1Bytes = await fillSbd1(normalizedContractor, normalizedDeal);
  const sbd4Bytes = await fillSbd4(normalizedContractor, normalizedDeal);

  return mergeTenderPack(summaryBytes, sbd1Bytes, sbd4Bytes);
}

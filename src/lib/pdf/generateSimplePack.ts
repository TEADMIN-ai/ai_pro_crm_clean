import { generateTenderPdf } from "@/lib/pdf/generateTenderPdf";

function getString(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
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

export async function generateSimplePack(deal: Record<string, unknown>, contractor: Record<string, unknown>) {
  const analysis = deal.analysis && typeof deal.analysis === "object"
    ? (deal.analysis as Record<string, unknown>)
    : {};
  const readinessScore =
    getNumber(deal.readinessScore) ??
    getNumber(analysis.score) ??
    getNumber(contractor.readinessScore);
  const missingDocs =
    getStringArray(deal.missingDocs).length > 0
      ? getStringArray(deal.missingDocs)
      : getStringArray(deal.missingRequirements).length > 0
        ? getStringArray(deal.missingRequirements)
        : getStringArray(analysis.missing);
  const riskGrade =
    getOptionalString(deal.riskGrade) ??
    getOptionalString(analysis.risk) ??
    getOptionalString(contractor.riskGrade);

  return generateTenderPdf(
    {
      id: getString(deal.id) || "N/A",
      title: getString(deal.title) || getString(deal.name) || "Tender Pack",
      value: getNumber(deal.value),
      status: getOptionalString(deal.status),
      readinessScore,
      missingDocs,
      riskGrade,
      riskLevel: riskGrade,
      tenderLockStatus: getOptionalString(deal.tenderLockStatus) ?? getOptionalString(contractor.tenderLockStatus),
      complianceApproved:
        typeof deal.complianceApproved === "boolean"
          ? deal.complianceApproved
          : typeof contractor.complianceApproved === "boolean"
            ? contractor.complianceApproved
            : undefined,
      suggestions: getStringArray(deal.suggestions),
      compliance: {
        readinessScore,
        tenderLockStatus: getOptionalString(deal.tenderLockStatus) ?? getOptionalString(contractor.tenderLockStatus),
        complianceApproved:
          typeof deal.complianceApproved === "boolean"
            ? deal.complianceApproved
            : typeof contractor.complianceApproved === "boolean"
              ? contractor.complianceApproved
              : null,
        riskGrade,
        docsMissing: getNumber(deal.docsMissing) ?? getNumber(contractor.docsMissing),
        missingDocumentTypes: missingDocs,
        legacyDocuments:
          contractor.documents && typeof contractor.documents === "object"
            ? contractor.documents as Record<string, { valid?: boolean; uploaded?: boolean; status?: string; documentType?: string }>
            : null,
        intelligence: {
          riskGrade,
          explainableSummary: getOptionalString(contractor.explainableSummary),
          blockedReasons: getStringArray(contractor.blockedReasons),
          reviewRecommendations:
            getStringArray(contractor.reviewRecommendations).length > 0
              ? getStringArray(contractor.reviewRecommendations)
              : getStringArray(deal.suggestions),
          documentBreakdown: Array.isArray(contractor.complianceDocumentBreakdown)
            ? contractor.complianceDocumentBreakdown as Array<{
                documentType?: string;
                label?: string;
                status?: string;
                reason?: string | null;
                suggestions?: string[];
              }>
            : null,
        },
      },
    },
    {
      id: getString(contractor.id) || "N/A",
      companyName:
        getString(contractor.companyName) ||
        getString(contractor.company) ||
        getString(contractor.name) ||
        "N/A",
      name: getOptionalString(contractor.name),
      registrationNumber:
        getOptionalString(contractor.registrationNumber) ??
        getOptionalString(contractor.companyRegistrationNumber),
      companyRegistrationNumber: getOptionalString(contractor.companyRegistrationNumber),
      csdNumber: getOptionalString(contractor.csdNumber),
      contactPerson:
        getOptionalString(contractor.contactPerson) ??
        getOptionalString(contractor.contactName),
      contactName: getOptionalString(contractor.contactName),
      email:
        getOptionalString(contractor.email) ??
        getOptionalString(contractor.contactEmail),
      contactEmail: getOptionalString(contractor.contactEmail),
      phone:
        getOptionalString(contractor.phone) ??
        getOptionalString(contractor.contactPhone),
      contactPhone: getOptionalString(contractor.contactPhone),
      telephone: getOptionalString(contractor.telephone),
      bbbeeStatus:
        getOptionalString(contractor.bbbeeStatus) ??
        getOptionalString(contractor.bbbeeLevel) ??
        getOptionalString(contractor.bbbee),
      readinessScore,
      tenderLockStatus: getOptionalString(contractor.tenderLockStatus),
      complianceApproved: typeof contractor.complianceApproved === "boolean" ? contractor.complianceApproved : null,
      riskGrade,
      docsMissing: getNumber(contractor.docsMissing),
      missingDocumentTypes: getStringArray(contractor.missingDocumentTypes),
      missingCriticalDocuments: getStringArray(contractor.missingCriticalDocuments),
      explainableSummary: getOptionalString(contractor.explainableSummary),
      blockedReasons: getStringArray(contractor.blockedReasons),
      reviewRecommendations: getStringArray(contractor.reviewRecommendations),
      complianceDocumentBreakdown: Array.isArray(contractor.complianceDocumentBreakdown)
        ? contractor.complianceDocumentBreakdown as Array<{
            documentType?: string;
            label?: string;
            status?: string;
            reason?: string | null;
            suggestions?: string[];
          }>
        : null,
      documents:
        contractor.documents && typeof contractor.documents === "object"
          ? contractor.documents as Record<string, { valid?: boolean; uploaded?: boolean; status?: string; documentType?: string }>
          : null,
    },
  );
}

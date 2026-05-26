import { type SupportedDocumentType } from "@/lib/compliance/contractorCompliance";
import { computeComplianceScore, resolveComplianceExpiryAlert, type ComplianceExpiryAlertState } from "@/lib/compliance/complianceScoring";

export type ComplianceDocumentStatus = "uploaded" | "verified" | "invalid" | "expired" | "expiringSoon";

export type ComplianceAnalysisResult = {
  documentType: SupportedDocumentType;
  complianceType: SupportedDocumentType;
  verified: boolean;
  expiresAt: number | null;
  expiryDate: number | null;
  expiryAlert: ComplianceExpiryAlertState;
  expiryAlertMessage: string | null;
  extractedFields: Record<string, string | null>;
  missingFields: string[];
  validationErrors: string[];
  confidenceScore: number;
  complianceScore: number;
  validationError: string | null;
  status: ComplianceDocumentStatus;
};

function parseDateDDMMYYYY(dateString: string): Date | null {
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveStatus(params: {
  expiresAt: number | null;
  verified: boolean;
  validationError: string | null;
  now: number;
}): ComplianceDocumentStatus {
  const { expiresAt, verified, validationError, now } = params;

  if (typeof expiresAt === "number") {
    if (expiresAt <= now) {
      return "expired";
    }

    if (expiresAt <= now + 30 * 24 * 60 * 60 * 1000) {
      return "expiringSoon";
    }
  }

  if (verified) {
    return "verified";
  }

  if (validationError) {
    return "invalid";
  }

  return "uploaded";
}

function toConfidence(foundFieldCount: number, requiredFieldCount: number): number {
  if (requiredFieldCount <= 0) {
    return 0;
  }

  return Number((foundFieldCount / requiredFieldCount).toFixed(2));
}

function buildResult(params: {
  documentType: SupportedDocumentType;
  extractedFields: Record<string, string | null>;
  expiresAt?: Date | null;
  verified: boolean;
  missingFields?: string[];
  validationErrors?: string[];
  validationError?: string | null;
  confidenceScore: number;
}): ComplianceAnalysisResult {
  const expiresAt = params.expiresAt ? params.expiresAt.getTime() : null;
  const now = Date.now();
  const validationError = params.validationError ?? null;
  const status = resolveStatus({
    expiresAt,
    verified: params.verified,
    validationError,
    now,
  });
  const expiryAlert = resolveComplianceExpiryAlert(expiresAt, now);

  return {
    documentType: params.documentType,
    complianceType: params.documentType,
    verified: params.verified,
    expiresAt,
    expiryDate: expiresAt,
    expiryAlert: expiryAlert.state,
    expiryAlertMessage: expiryAlert.message,
    extractedFields: params.extractedFields,
    missingFields: params.missingFields ?? [],
    validationErrors: params.validationErrors ?? (validationError ? [validationError] : []),
    confidenceScore: params.confidenceScore,
    complianceScore: computeComplianceScore({
      status,
      confidenceScore: params.confidenceScore,
    }),
    validationError,
    status,
  };
}

export function analyzeComplianceDocument(
  type: SupportedDocumentType,
  text: string
): ComplianceAnalysisResult {
  const now = Date.now();

  switch (type) {
    case "cipc": {
      const regMatch = text.match(/\b\d{4}\/\d{6}\/\d{2}\b/);
      const companyNameMatch = text.match(/(?:enterprise name|company name)[:\s]+([A-Z0-9][A-Z0-9 '&.,()-]{2,})/i);
      const missingFields = [
        ...(!regMatch ? ["companyRegistrationNumber"] : []),
        ...(!companyNameMatch ? ["companyName"] : []),
      ];

      return buildResult({
        documentType: type,
        extractedFields: {
          companyRegistrationNumber: regMatch?.[0] ?? null,
          companyName: companyNameMatch?.[1]?.trim() ?? null,
        },
        verified: Boolean(regMatch && companyNameMatch),
        missingFields,
        validationError: missingFields.length === 0 ? null : `Missing CIPC fields: ${missingFields.join(", ")}`,
        confidenceScore: toConfidence(Number(Boolean(regMatch)) + Number(Boolean(companyNameMatch)), 2),
      });
    }

    case "bbbee": {
      const levelMatch = text.match(/B[- ]?BBEE(?:\s+Status)?\s+Level[:\s]+(\d)/i);
      const expiryMatch = text.match(/Expiry Date[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
      const certMatch = text.match(/Certificate Number[:\s]+([A-Z0-9-]+)/i);

      const expiresAt = expiryMatch ? parseDateDDMMYYYY(expiryMatch[1]) : null;
      const missingFields = [
        ...(!levelMatch ? ["beeLevel"] : []),
        ...(!certMatch ? ["certificateNumber"] : []),
        ...(!expiryMatch ? ["expiryDate"] : []),
      ];
      const hasRequiredFields = Boolean(levelMatch && certMatch && expiresAt);

      return buildResult({
        documentType: type,
        extractedFields: {
          beeLevel: levelMatch?.[1] ?? null,
          certificateNumber: certMatch?.[1] ?? null,
          expiryDate: expiryMatch?.[1] ?? null,
        },
        expiresAt,
        missingFields,
        verified: Boolean(expiresAt && expiresAt.getTime() > now && hasRequiredFields),
        validationError: hasRequiredFields ? null : `Missing B-BBEE fields: ${missingFields.join(", ")}`,
        confidenceScore: toConfidence(
          Number(Boolean(levelMatch)) + Number(Boolean(certMatch)) + Number(Boolean(expiryMatch)),
          3
        ),
      });
    }

    case "taxClearance": {
      const hasTcsKeyword = /\b(?:tax compliance status|tcs)\b/i.test(text);
      const hasTaxClearanceKeyword = /\btax clearance(?: certificate)?\b/i.test(text);
      const hasNoticeOfRegistration = /\bnotice of registration\b/i.test(text);
      const hasVatRegistration = /\b(?:vat registration|value-added tax registration)\b/i.test(text);
      const expiryMatch = text.match(/(?:expiry|valid until|valid to)[:\s]+(\d{2}\/\d{2}\/\d{4})/i) ?? text.match(/(\d{2}\/\d{2}\/\d{4})/);
      const taxPinMatch = text.match(/(?:pin|tax compliance status pin)[:\s]+([A-Z0-9]+)/i);
      const taxpayerMatch = text.match(/(?:taxpayer name|registered name)[:\s]+([A-Z0-9][A-Z0-9 '&.,()-]{2,})/i);
      const supportingOnly = hasNoticeOfRegistration || hasVatRegistration;
      const expiresAt = supportingOnly ? null : expiryMatch ? parseDateDDMMYYYY(expiryMatch[1]) : null;
      const hasExpiry = Boolean(expiresAt);
      const missingFields = [
        ...(!supportingOnly && !expiryMatch ? ["expiryDate"] : []),
        ...(!(hasTcsKeyword || hasTaxClearanceKeyword) ? ["taxComplianceProof"] : []),
        ...(!supportingOnly && !taxPinMatch ? ["taxPin"] : []),
        ...(!taxpayerMatch ? ["taxpayerName"] : []),
      ];

      return buildResult({
        documentType: type,
        extractedFields: {
          taxDocumentCategory: supportingOnly
            ? hasVatRegistration
              ? "VAT_REGISTRATION_NOTICE"
              : "SARS_NOTICE_OF_REGISTRATION"
            : hasTcsKeyword && taxPinMatch
              ? "TCS_PIN_DOCUMENT"
              : hasTcsKeyword
                ? "TAX_COMPLIANCE_STATUS"
                : hasTaxClearanceKeyword
                  ? "LEGACY_TAX_CLEARANCE_CERTIFICATE"
                  : "UNKNOWN_TAX_DOCUMENT",
          taxPin: taxPinMatch?.[1] ?? null,
          taxpayerName: taxpayerMatch?.[1]?.trim() ?? null,
          expiryDate: expiryMatch?.[1] ?? null,
        },
        expiresAt,
        missingFields,
        verified: Boolean(!supportingOnly && expiresAt && expiresAt.getTime() > now && (hasTcsKeyword || hasTaxClearanceKeyword)),
        validationError: supportingOnly
          ? "Supporting SARS registration document detected; active Tax Compliance Status proof is still required"
          : hasExpiry
            ? null
            : `Missing tax compliance fields: ${missingFields.join(", ")}`,
        confidenceScore: toConfidence(
          Number(Boolean(expiryMatch)) + Number(Boolean(taxPinMatch)) + Number(Boolean(taxpayerMatch)) + Number(Boolean(hasTcsKeyword || hasTaxClearanceKeyword)),
          4
        ),
      });
    }

    case "coida": {
      const expiryMatch = text.match(/(?:expiry|valid until|period ending)[:\s]+(\d{2}\/\d{2}\/\d{4})/i) ?? text.match(/(\d{2}\/\d{2}\/\d{4})/);
      const employerMatch = text.match(/(?:employer(?:'s)? registration(?: number)?)[:\s]+([A-Z0-9/-]+)/i);
      const expiresAt = expiryMatch ? parseDateDDMMYYYY(expiryMatch[1]) : null;
      const hasExpiry = Boolean(expiresAt);
      const missingFields = [
        ...(!employerMatch ? ["employerRegistrationNumber"] : []),
        ...(!expiryMatch ? ["expiryDate"] : []),
      ];

      return buildResult({
        documentType: type,
        extractedFields: {
          employerRegistrationNumber: employerMatch?.[1] ?? null,
          expiryDate: expiryMatch?.[1] ?? null,
        },
        expiresAt,
        missingFields,
        verified: Boolean(expiresAt && expiresAt.getTime() > now),
        validationError: hasExpiry ? null : `Missing COIDA fields: ${missingFields.join(", ")}`,
        confidenceScore: toConfidence(Number(Boolean(expiryMatch)) + Number(Boolean(employerMatch)), 2),
      });
    }

    case "bankConfirmation": {
      const accountMatch = text.match(/Account\s*Number[:\s]+(\d+)/i);
      const bankMatch = text.match(/Bank\s*Name[:\s]+([A-Za-z\s]+)/i);
      const accountHolderMatch = text.match(/(?:account holder|account name)[:\s]+([A-Z][A-Z0-9 '&.,()-]{2,})/i);
      const branchCodeMatch = text.match(/(?:branch code|branch no\.?)[:\s]+(\d{3,10})/i);
      const hasRequiredFields = Boolean(accountMatch && bankMatch);
      const missingFields = [
        ...(!accountMatch ? ["accountNumber"] : []),
        ...(!bankMatch ? ["bankName"] : []),
        ...(!accountHolderMatch ? ["accountHolder"] : []),
        ...(!branchCodeMatch ? ["branchCode"] : []),
      ];

      return buildResult({
        documentType: type,
        extractedFields: {
          accountNumber: accountMatch?.[1] ?? null,
          bankName: bankMatch?.[1]?.trim() ?? null,
          accountHolder: accountHolderMatch?.[1]?.trim() ?? null,
          branchCode: branchCodeMatch?.[1] ?? null,
        },
        missingFields,
        verified: hasRequiredFields,
        validationError: hasRequiredFields ? null : `Missing bank confirmation fields: ${missingFields.join(", ")}`,
        confidenceScore: toConfidence(
          Number(Boolean(accountMatch)) +
            Number(Boolean(bankMatch)) +
            Number(Boolean(accountHolderMatch)) +
            Number(Boolean(branchCodeMatch)),
          4
        ),
      });
    }

    default:
      return buildResult({
        documentType: type,
        extractedFields: {},
        verified: false,
        missingFields: [],
        validationError: "Unknown document type",
        confidenceScore: 0,
      });
  }
}

export function verifyComplianceDocument(
  type: SupportedDocumentType,
  text: string
): ComplianceAnalysisResult {
  return analyzeComplianceDocument(type, text);
}

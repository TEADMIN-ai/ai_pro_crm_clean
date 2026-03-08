import type { DocumentIntelligenceResult } from "@/lib/intelligence/documentIntelligenceEngine";

export type AutoFillPreview = {
  templateType: string;
  sections: {
    registration: {
      sbd1: {
        registrationNumber: string;
        vatNumber: string;
      };
      sbd4: {
        registrationNumber: string;
        vatNumber: string;
      };
    };
    compliance: {
      expiryDates: string[];
      earliestExpiryDate: string;
    };
  };
  mappedFields: Array<{
    field: string;
    value: string | string[];
    source: "registrationNumbers" | "expiryDates";
  }>;
};

export function generateAutoFillPreview(
  extractedFields: DocumentIntelligenceResult["extractedFields"],
  templateType: string
): AutoFillPreview {
  const registrationNumbers = extractedFields.registrationNumbers ?? [];
  const expiryDates = extractedFields.expiryDates ?? [];

  const firstRegistration =
    registrationNumbers.find((value) => value.startsWith("REG:")) ??
    registrationNumbers.find((value) => value.startsWith("CIDB:")) ??
    registrationNumbers[0] ??
    "";
  const vatNumber =
    registrationNumbers.find((value) => value.startsWith("VAT:"))?.replace("VAT:", "") ?? "";
  const normalizedRegistration = firstRegistration
    .replace(/^REG:/, "")
    .replace(/^CIDB:/, "")
    .trim();

  const sortedExpiryDates = [...expiryDates].sort();
  const earliestExpiryDate = sortedExpiryDates[0] ?? "";

  return {
    templateType,
    sections: {
      registration: {
        sbd1: {
          registrationNumber: normalizedRegistration,
          vatNumber,
        },
        sbd4: {
          registrationNumber: normalizedRegistration,
          vatNumber,
        },
      },
      compliance: {
        expiryDates,
        earliestExpiryDate,
      },
    },
    mappedFields: [
      {
        field: "SBD1.registrationNumber",
        value: normalizedRegistration,
        source: "registrationNumbers",
      },
      {
        field: "SBD1.vatNumber",
        value: vatNumber,
        source: "registrationNumbers",
      },
      {
        field: "SBD4.registrationNumber",
        value: normalizedRegistration,
        source: "registrationNumbers",
      },
      {
        field: "SBD4.vatNumber",
        value: vatNumber,
        source: "registrationNumbers",
      },
      {
        field: "compliance.expiryDates",
        value: expiryDates,
        source: "expiryDates",
      },
      {
        field: "compliance.earliestExpiryDate",
        value: earliestExpiryDate,
        source: "expiryDates",
      },
    ],
  };
}

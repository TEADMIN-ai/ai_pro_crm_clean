import type { DriverLicenceExtraction } from "../extractors/driverLicenceExtractor";
import type { VehicleFinanceTextQualityAssessment } from "../ocr/textQualityAssessment";

export type DriverLicenceVerificationFlag =
  | "EXPIRED_LICENCE"
  | "LICENCE_EXPIRING_SOON"
  | "LICENCE_EXPIRING_CRITICAL"
  | "MISSING_ID"
  | "MISSING_NAME"
  | "MISSING_LICENCE_NUMBER"
  | "LOW_CONFIDENCE_OCR";

export type DriverLicenceVerificationResult = {
  passed: boolean;
  score: number;
  flags: DriverLicenceVerificationFlag[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isExpired(dateValue: string | null): boolean {
  if (!dateValue) {
    return false;
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? false : parsed.getTime() < Date.now();
}

function daysUntilExpiry(dateValue: string | null): number | null {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((parsed.getTime() - Date.now()) / millisecondsPerDay);
}

export function verifyDriverLicenceExtraction(
  extraction: DriverLicenceExtraction,
  quality?: VehicleFinanceTextQualityAssessment | null,
): DriverLicenceVerificationResult {
  const flags: DriverLicenceVerificationFlag[] = [];
  let score = 100;

  if (!extraction.name || !extraction.surname) {
    flags.push("MISSING_NAME");
    score -= 30;
  }

  if (!extraction.idNumber) {
    flags.push("MISSING_ID");
    score -= 30;
  }

  if (!extraction.licenceNumber) {
    flags.push("MISSING_LICENCE_NUMBER");
    score -= 20;
  }

  const expiryDays = daysUntilExpiry(extraction.expiryDate);
  if (isExpired(extraction.expiryDate)) {
    flags.push("EXPIRED_LICENCE");
    score -= 40;
  } else if (typeof expiryDays === "number" && expiryDays <= 30) {
    flags.push("LICENCE_EXPIRING_CRITICAL");
    score -= 30;
  } else if (typeof expiryDays === "number" && expiryDays <= 90) {
    flags.push("LICENCE_EXPIRING_SOON");
    score -= 15;
  }

  if (typeof quality?.confidence === "number" && quality.confidence < quality.confidenceThreshold) {
    flags.push("LOW_CONFIDENCE_OCR");
    score -= 20;
  }

  if (quality && !quality.usable) {
    if (!flags.includes("LOW_CONFIDENCE_OCR")) {
      flags.push("LOW_CONFIDENCE_OCR");
    }
    score -= 40;
  }

  return {
    passed: score >= 70 && flags.length === 0,
    score: clamp(score),
    flags: Array.from(new Set(flags)),
  };
}

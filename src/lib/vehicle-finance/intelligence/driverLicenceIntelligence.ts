import { runOCRDetailed } from "@/server/services/ocrService";
import type { VehicleFinanceApplication, VehicleFinanceCustomer, VehicleFinanceDocumentAnalysis, VehicleFinanceDriverLicenceIntelligence } from "@/types/vehicleFinance";
import { getVehicleFinanceFeatureFlags } from "../config/featureFlags";
import { classifyVehicleFinanceDocument } from "../classification/documentClassifier";
import { extractDriverLicenceDetails } from "../extractors/driverLicenceExtractor";
import { assessVehicleFinanceTextQuality } from "../ocr/textQualityAssessment";
import { compareApplicationToDriverLicence } from "../verification/applicationComparison";
import { verifyDriverLicenceExtraction } from "../verification/driverLicenceVerification";
import { resolveVehicleFinanceLicenceIntelligenceFlag } from "../config/featureFlags";

type BuildDriverLicenceIntelligenceArgs = {
  application: VehicleFinanceApplication | null;
  customer: VehicleFinanceCustomer | null;
  documentType: VehicleFinanceDocumentAnalysis["documentType"];
  extractedText: string;
  directTextLength: number;
  ocrTextLength: number;
  pageCount: number;
  extractionSource: VehicleFinanceDocumentAnalysis["extractionSource"];
  fileBuffer: Buffer;
  filename: string;
  documentIntegrityScore: number;
};

export async function buildVehicleFinanceDriverLicenceIntelligence(
  args: BuildDriverLicenceIntelligenceArgs,
): Promise<VehicleFinanceDriverLicenceIntelligence | null> {
  const flagResolution = resolveVehicleFinanceLicenceIntelligenceFlag();
  const flags = getVehicleFinanceFeatureFlags();

  console.log("[LICENCE_INTELLIGENCE_ENTERED]", {
    flagNameFound: flagResolution.flagNameFound,
    resolvedValue: flagResolution.resolvedValue,
    source: flagResolution.source,
    documentType: args.documentType,
    filename: args.filename,
    sourceTextLength: args.extractedText.length,
  });

  if (!flags.ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE) {
    return null;
  }

  console.log("[TEXT_QUALITY_CHECK]", {
    filename: args.filename,
    textLength: args.extractedText.length,
    documentIntegrityScore: args.documentIntegrityScore,
    pageCount: args.pageCount,
  });

  const initialQuality = assessVehicleFinanceTextQuality(args.extractedText, {
    confidence: args.documentIntegrityScore,
    confidenceThreshold: 70,
    minTextLength: 300,
  });

  const needsFallback = initialQuality.shouldRunOcrFallback;
  if (needsFallback) {
    console.log("[OCR_TRIGGERED]", {
      filename: args.filename,
      reason: initialQuality.flags,
      confidence: initialQuality.confidence,
      textLength: initialQuality.textLength,
    });
  }

  const fallbackResult = needsFallback
    ? await runOCRDetailed(args.fileBuffer, {
        filename: args.filename,
        mimeType: "application/pdf",
        pageCount: args.pageCount,
      })
    : null;

  const enhancedText = fallbackResult?.text?.trim() || args.extractedText.trim();
  const enhancedQuality = assessVehicleFinanceTextQuality(enhancedText, {
    confidence: Math.max(initialQuality.confidence, fallbackResult?.provider ? 80 : initialQuality.confidence),
    confidenceThreshold: 70,
    minTextLength: 300,
  });

  const classification = classifyVehicleFinanceDocument(enhancedText);
  console.log("[DOCUMENT_CLASSIFIED]", {
    filename: args.filename,
    documentType: classification.documentType,
    confidence: classification.confidence,
    reasons: classification.reasons,
  });

  const shouldExtract = classification.documentType === "DRIVER_LICENCE" && classification.confidence >= 50;
  const extraction = shouldExtract
    ? extractDriverLicenceDetails(enhancedText)
    : {
        name: null,
        surname: null,
        idNumber: null,
        licenceNumber: null,
        issueDate: null,
        expiryDate: null,
        licenceCode: null,
        confidence: 0,
      };

  console.log("[LICENCE_EXTRACTED]", {
    filename: args.filename,
    executed: shouldExtract,
    extraction,
  });

  const verification = verifyDriverLicenceExtraction(extraction, enhancedQuality);
  console.log("[VERIFICATION_COMPLETE]", {
    filename: args.filename,
    executed: true,
    passed: verification.passed,
    score: verification.score,
    flags: verification.flags,
  });

  const applicationComparison =
    args.application && args.customer
      ? compareApplicationToDriverLicence(args.application, args.customer, extraction)
      : null;

  return {
    enabled: true,
    featureFlag: true,
    textQuality: enhancedQuality,
    classification,
    extraction,
    verification,
    applicationComparison,
    usedOcrFallback: needsFallback,
    sourceTextLength: args.extractedText.length,
    enhancedTextLength: enhancedText.length,
    selectedText: enhancedText,
  };
}

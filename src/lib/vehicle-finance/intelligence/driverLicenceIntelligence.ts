import { runOCRDetailed } from "@/server/services/ocrService";
import type { VehicleFinanceApplication, VehicleFinanceCustomer, VehicleFinanceDocumentAnalysis, VehicleFinanceDriverLicenceIntelligence } from "@/types/vehicleFinance";
import { getVehicleFinanceFeatureFlags } from "../config/featureFlags";
import { classifyVehicleFinanceDocument } from "../classification/documentClassifier";
import { extractDriverLicenceDetails } from "../extractors/driverLicenceExtractor";
import { assessVehicleFinanceTextQuality } from "../ocr/textQualityAssessment";
import { compareApplicationToDriverLicence } from "../verification/applicationComparison";
import { verifyDriverLicenceExtraction } from "../verification/driverLicenceVerification";

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
  const flags = getVehicleFinanceFeatureFlags();
  if (!flags.ENABLE_VEHICLE_FINANCE_LICENCE_INTELLIGENCE) {
    return null;
  }

  const initialQuality = assessVehicleFinanceTextQuality(args.extractedText, {
    confidence: args.documentIntegrityScore,
    confidenceThreshold: 70,
    minTextLength: 300,
  });

  const needsFallback = initialQuality.shouldRunOcrFallback;
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

  const verification = verifyDriverLicenceExtraction(extraction, enhancedQuality);
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

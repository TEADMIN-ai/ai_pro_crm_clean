import { runOCRDetailed } from "@/server/services/ocrService";
import type { VehicleFinanceDocumentAnalysis, VehicleFinanceIdentityDocumentIntelligence } from "@/types/vehicleFinance";
import { classifyVehicleFinanceDocument } from "../classification/documentClassifier";
import { extractGreenIdBookDetails } from "../extractors/greenIdBookExtractor";
import { extractSmartIdCardDetails } from "../extractors/smartIdCardExtractor";
import { assessVehicleFinanceTextQuality } from "../ocr/textQualityAssessment";
import { verifyIdentityExtraction } from "../verification/identityVerification";

type BuildIdentityIntelligenceArgs = {
  documentType: VehicleFinanceDocumentAnalysis["documentType"];
  extractedText: string;
  fileBuffer: Buffer;
  filename: string;
  pageCount: number;
  documentIntegrityScore: number;
};

export async function buildVehicleFinanceIdentityIntelligence(
  args: BuildIdentityIntelligenceArgs,
): Promise<VehicleFinanceIdentityDocumentIntelligence | null> {
  const initialQuality = assessVehicleFinanceTextQuality(args.extractedText, {
    confidence: args.documentIntegrityScore,
    confidenceThreshold: 70,
    minTextLength: 300,
  });

  const fallbackResult = initialQuality.shouldRunOcrFallback
    ? await runOCRDetailed(args.fileBuffer, {
        filename: args.filename,
        mimeType: "application/pdf",
        pageCount: args.pageCount,
      })
    : null;

  const selectedText = fallbackResult?.text?.trim() || args.extractedText.trim();
  const enhancedQuality = assessVehicleFinanceTextQuality(selectedText, {
    confidence: Math.max(initialQuality.confidence, fallbackResult?.provider ? 80 : initialQuality.confidence),
    confidenceThreshold: 70,
    minTextLength: 300,
  });

  const classification = classifyVehicleFinanceDocument(selectedText);
  const effectiveType =
    classification.documentType === "GREEN_ID_BOOK" || classification.documentType === "SMART_ID_CARD"
      ? classification.documentType
      : args.documentType === "greenIdBook"
        ? "GREEN_ID_BOOK"
        : args.documentType === "smartIdCard"
          ? "SMART_ID_CARD"
          : "UNKNOWN_IDENTITY_DOCUMENT";

  if (effectiveType === "UNKNOWN_IDENTITY_DOCUMENT") {
    return null;
  }

  console.log("[IDENTITY_INTELLIGENCE_ENTERED]", {
    documentType: args.documentType,
    classification: classification.documentType,
    confidence: classification.confidence,
  });

  const extraction =
    effectiveType === "GREEN_ID_BOOK"
      ? extractGreenIdBookDetails(selectedText)
      : extractSmartIdCardDetails(selectedText);

  console.log("[IDENTITY_FIELD_MAPPING]", {
    documentType: effectiveType,
    extraction,
  });

  const verification = verifyIdentityExtraction(extraction);

  const intelligence: VehicleFinanceIdentityDocumentIntelligence = {
    enabled: true,
    featureFlag: true,
    documentType: effectiveType,
    classification: {
      ...classification,
      documentType: effectiveType,
    },
    extraction,
    fields: extraction,
    verification,
    integrityIndicators: extraction.integrityIndicators,
    overallConfidence: extraction.confidence,
    sourceText: selectedText,
    sourceTextLength: selectedText.length,
    selectedText,
  };

  console.log("[IDENTITY_VERIFICATION_COMPLETE]", {
    documentType: effectiveType,
    score: verification.score,
    flags: verification.flags,
  });

  return intelligence;
}

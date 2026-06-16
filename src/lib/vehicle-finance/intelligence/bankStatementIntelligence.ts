import { runOCRDetailed } from "@/server/services/ocrService";
import type { VehicleFinanceDocumentAnalysis, VehicleFinanceBankStatementIntelligence } from "@/types/vehicleFinance";
import { classifyVehicleFinanceDocument } from "../classification/documentClassifier";
import { assessVehicleFinanceTextQuality } from "../ocr/textQualityAssessment";
import { extractBankStatementDetails } from "../extractors/bankStatementExtractor";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

type BuildBankStatementIntelligenceArgs = {
  documentType: VehicleFinanceDocumentAnalysis["documentType"];
  extractedText: string;
  fileBuffer: Buffer;
  filename: string;
  pageCount: number;
  documentIntegrityScore: number;
};

export async function buildVehicleFinanceBankStatementIntelligence(
  args: BuildBankStatementIntelligenceArgs,
): Promise<VehicleFinanceBankStatementIntelligence | null> {
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
  const effectiveType = classification.documentType === "BANK_STATEMENT" || args.documentType === "bankStatement" ? "BANK_STATEMENT" : "UNKNOWN";
  if (effectiveType === "UNKNOWN") {
    return null;
  }

  console.log("[BANK_STATEMENT_INTELLIGENCE_ENTERED]", {
    documentType: args.documentType,
    classification: classification.documentType,
    confidence: classification.confidence,
  });

  const extraction = extractBankStatementDetails(selectedText);
  console.log("[BANK_STATEMENT_FIELD_MAPPING]", {
    documentType: effectiveType,
    extraction,
  });

  const verification = verifyBankStatementExtraction(extraction);
  console.log("[BANK_STATEMENT_VERIFICATION_COMPLETE]", {
    documentType: effectiveType,
    verificationScore: verification.verificationScore,
    flags: verification.flags,
  });

  return {
    enabled: true,
    featureFlag: true,
    documentType: effectiveType,
    classification: {
      ...classification,
      documentType: effectiveType,
    },
    extraction,
    verification,
    overallConfidence: extraction.confidence,
    sourceText: selectedText,
    sourceTextLength: selectedText.length,
    selectedText,
    crossDocumentPreparation: extraction.crossDocumentPreparation,
    fields: extraction,
  };
}

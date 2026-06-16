import type {
  VehicleFinanceBankFingerprint,
  VehicleFinanceBankStatementCrossDocumentPreparation,
  VehicleFinanceBankStatementStructuredExtraction,
} from "@/types/vehicleFinance";
import { classifyBankStatement } from "../classification/bankStatementClassifier";
import { resolveBankTemplate } from "../banks/bankTemplateRegistry";

export type BankStatementExtraction = VehicleFinanceBankStatementStructuredExtraction & {
  documentType: "BANK_STATEMENT";
  bankNameClassification: ReturnType<typeof classifyBankStatement>;
  bankFingerprint: VehicleFinanceBankFingerprint;
  confidence: number;
  crossDocumentPreparation: VehicleFinanceBankStatementCrossDocumentPreparation;
};

export function extractBankStatementDetails(text: string): BankStatementExtraction {
  const normalized = (text ?? "").normalize("NFKC");
  const bankNameClassification = classifyBankStatement(normalized);
  const template = resolveBankTemplate(normalized);
  const extraction = template.extract(normalized);
  const bankFingerprint = extraction.bankFingerprint ?? template.detect(normalized);

  return {
    documentType: "BANK_STATEMENT",
    bankNameClassification,
    bankFingerprint,
    ...extraction,
    confidence: extraction.confidence ?? bankFingerprint.confidence,
    crossDocumentPreparation: extraction.crossDocumentPreparation ?? {
      employeeName: { value: null, confidence: 0, sourceText: "" },
      employerName: { value: null, confidence: 0, sourceText: "" },
      netPay: { value: null, confidence: 0, sourceText: "" },
      salaryDeposits: [],
    },
  };
}

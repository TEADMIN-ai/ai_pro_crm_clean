import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "WESBANK",
  displayName: "WesBank",
  brandingSignals: [/\bwesbank\b/i, /\bwes\s*bank\b/i, /\bvehicle\s+finance\b/i],
  versionHints: [
    { pattern: /vehicle\s+finance\s+statement/i, documentVersion: "VEHICLE_FINANCE_STATEMENT", statementLayout: "WESBANK_FINANCE_LAYOUT", confidence: 96 },
  ],
  layoutSignals: [/vehicle\s+finance/i, /repayment\s+schedule/i, /statement/i],
  footerSignals: [/\bwesbank\b/i],
  summarySignals: [/vehicle\s+finance/i, /repayment\s+schedule/i],
};

export const wesbankTemplate: BankTemplate = {
  bankName: config.bankName,
  detect(text) {
    return detectBankFingerprint(text, config);
  },
  extract(text) {
    return extractBankStatementCore(text, config);
  },
  verify(extraction) {
    return verifyBankStatementExtraction(extraction);
  },
  confidence(text) {
    return detectBankFingerprint(text, config).confidence;
  },
};

export default wesbankTemplate;

import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "ABSA",
  displayName: "Absa",
  brandingSignals: [/\babsa\b/i],
  versionHints: [
    { pattern: /your\s+statement/i, documentVersion: "YOUR_STATEMENT", statementLayout: "ABSA_STATEMENT_LAYOUT", confidence: 95 },
  ],
  layoutSignals: [/your\s+statement/i, /account\s+summary/i],
  footerSignals: [/\babsa\b/i],
  summarySignals: [/your\s+statement/i],
};

export const absaTemplate: BankTemplate = {
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

export default absaTemplate;

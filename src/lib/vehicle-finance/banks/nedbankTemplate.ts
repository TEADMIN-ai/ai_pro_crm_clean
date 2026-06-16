import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "NEDBANK",
  displayName: "Nedbank",
  brandingSignals: [/\bnedbank\b/i],
  versionHints: [
    { pattern: /statement\s+summary/i, documentVersion: "STATEMENT_SUMMARY", statementLayout: "NEDBANK_STATEMENT_SUMMARY_LAYOUT", confidence: 95 },
  ],
  layoutSignals: [/statement\s+summary/i, /account\s+summary/i],
  footerSignals: [/\bnedbank\b/i],
  summarySignals: [/statement\s+summary/i],
};

export const nedbankTemplate: BankTemplate = {
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

export default nedbankTemplate;

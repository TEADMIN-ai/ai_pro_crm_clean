import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "STANDARD_BANK",
  displayName: "Standard Bank",
  brandingSignals: [/\bstandard\s+bank\b/i],
  versionHints: [
    {
      pattern: /transactional\s+account\s+statement/i,
      documentVersion: "TRANSACTIONAL_ACCOUNT_STATEMENT",
      statementLayout: "STANDARD_BANK_TRANSACTION_LAYOUT",
      confidence: 96,
    },
  ],
  layoutSignals: [/transactional\s+account\s+statement/i, /statement\s+summary/i],
  footerSignals: [/\bstandard\s+bank\b/i],
  summarySignals: [/statement\s+summary/i],
};

export const standardBankTemplate: BankTemplate = {
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

export default standardBankTemplate;

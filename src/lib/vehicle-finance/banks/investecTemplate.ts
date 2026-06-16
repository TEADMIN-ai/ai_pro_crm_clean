import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "INVESTEC",
  displayName: "Investec",
  brandingSignals: [/\binvestec\b/i],
  versionHints: [
    { pattern: /private\s+banking\s+statement/i, documentVersion: "PRIVATE_BANKING_STATEMENT", statementLayout: "INVESTEC_PRIVATE_BANKING_LAYOUT", confidence: 96 },
  ],
  layoutSignals: [/private\s+banking\s+statement/i, /statement\s+summary/i],
  footerSignals: [/\binvestec\b/i],
  summarySignals: [/private\s+banking\s+statement/i],
};

export const investecTemplate: BankTemplate = {
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

export default investecTemplate;

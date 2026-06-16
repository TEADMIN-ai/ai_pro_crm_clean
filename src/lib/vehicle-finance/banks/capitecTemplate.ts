import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";
import { extractBankStatementCore } from "./extractCore";
import { detectBankFingerprint } from "./bankTemplateUtils";

const config: BankTemplateConfig = {
  bankName: "CAPITEC",
  displayName: "Capitec",
  brandingSignals: [/\bcapitec\b/i],
  versionHints: [
    { pattern: /main\s+account\s+statement/i, documentVersion: "MAIN_ACCOUNT_STATEMENT", statementLayout: "CAPITEC_MAIN_ACCOUNT_LAYOUT", confidence: 96 },
  ],
  layoutSignals: [/account\s+summary/i, /transaction\s+history/i],
  footerSignals: [/capitec/i],
  summarySignals: [/main\s+account\s+statement/i, /account\s+summary/i],
};

export const capitecTemplate: BankTemplate = {
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

export default capitecTemplate;

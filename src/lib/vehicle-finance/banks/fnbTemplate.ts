import type { BankTemplate, BankTemplateConfig } from "./bankTemplateUtils";
import { detectBankFingerprint } from "./bankTemplateUtils";
import { extractBankStatementCore } from "./extractCore";
import { verifyBankStatementExtraction } from "../verification/bankStatementVerification";

const config: BankTemplateConfig = {
  bankName: "FNB",
  displayName: "FNB",
  brandingSignals: [/\bfnb\b/i, /\bfirst\s+national\s+bank\b/i],
  versionHints: [
    { pattern: /eStatements?/i, documentVersion: "ESTATEMENTS", statementLayout: "FNB_ESTATEMENTS_LAYOUT", confidence: 96 },
  ],
  layoutSignals: [/eStatements?/i, /account\s+summary/i],
  footerSignals: [/\bfnb\b/i],
  summarySignals: [/eStatements?/i, /account\s+summary/i],
};

export const fnbTemplate: BankTemplate = {
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

export default fnbTemplate;

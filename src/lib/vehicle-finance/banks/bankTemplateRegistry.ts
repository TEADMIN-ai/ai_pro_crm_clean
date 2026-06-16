import type { VehicleFinanceBankName } from "../classification/bankStatementClassifier";
import type { BankTemplate } from "./bankTemplateUtils";
import { absaTemplate } from "./absaTemplate";
import { capitecTemplate } from "./capitecTemplate";
import { fnbTemplate } from "./fnbTemplate";
import { investecTemplate } from "./investecTemplate";
import { nedbankTemplate } from "./nedbankTemplate";
import { standardBankTemplate } from "./standardBankTemplate";
import { wesbankTemplate } from "./wesbankTemplate";

export const VEHICLE_FINANCE_BANK_TEMPLATES: BankTemplate[] = [
  capitecTemplate,
  fnbTemplate,
  standardBankTemplate,
  absaTemplate,
  nedbankTemplate,
  wesbankTemplate,
  investecTemplate,
];

export function resolveBankTemplate(text: string): BankTemplate {
  const candidates = VEHICLE_FINANCE_BANK_TEMPLATES
    .map((template) => ({ template, detection: template.detect(text) }))
    .sort((left, right) => right.detection.confidence - left.detection.confidence);

  return candidates[0]?.template ?? capitecTemplate;
}

export function detectBankStatementFingerprint(text: string) {
  const template = resolveBankTemplate(text);
  const fingerprint = template.detect(text);
  return {
    template,
    fingerprint,
  };
}

export function getBankTemplate(bankName: VehicleFinanceBankName): BankTemplate {
  return VEHICLE_FINANCE_BANK_TEMPLATES.find((template) => template.bankName === bankName) ?? capitecTemplate;
}

export function detectSelectedBankName(text: string): VehicleFinanceBankName {
  return detectBankStatementFingerprint(text).fingerprint.bankName;
}

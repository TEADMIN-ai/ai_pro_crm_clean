export type VehicleFinanceClassifiedDocumentType =
  | "DRIVER_LICENCE"
  | "GREEN_ID_BOOK"
  | "SMART_ID_CARD"
  | "SA_ID"
  | "PAYSLIP"
  | "BANK_STATEMENT"
  | "UNKNOWN"
  | "UNKNOWN_IDENTITY_DOCUMENT";

export type VehicleFinanceDocumentClassification = {
  documentType: VehicleFinanceClassifiedDocumentType;
  confidence: number;
  reasons: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function classifyVehicleFinanceDocument(text: string): VehicleFinanceDocumentClassification {
  const normalized = (text ?? "").toLowerCase();
  const reasons: string[] = [];

  const driverLicenceSignals = countMatches(normalized, [
    /\bdriver'?s?\s+licen[cs]e\b/,
    /\bdriving\s+licen[cs]e\b/,
    /\bcarta\s+de\s+condu[Ã§c]a[oÃµ]\b/,
    /\blicen[cs]e\s+number\b/,
    /\blicen[cs]e\s+code\b/,
    /\bissue(?:d)?\s+date\b/,
    /\bexpiry\s+date\b/,
    /\bvalid\s+from\b/,
    /\brestriction\b/,
    /\bid\s+no\.?\b/,
  ]);

  const greenIdSignals = countMatches(normalized, [
    /\bi\.?d\.?\s+no\.?\b/,
    /\bsurname\b/,
    /\bforenames\b/,
    /\bcountry\s+of\s+birth\b/,
    /\bdate\s+of\s+birth\b/,
    /\bdate\s+issued\b/,
    /\bsa\s+citizen\b/,
  ]);

  const smartIdSignals = countMatches(normalized, [
    /\bidentity\s+number\b/,
    /\bsurname\b/,
    /\bnames\b/,
    /\bsex\b/,
    /\bdate\s+of\s+birth\b/,
    /\bissue\s+number\b/,
    /\bnationality\b/,
    /\bcitizenship\b/,
  ]);

  const saIdSignals = countMatches(normalized, [
    /\bid\s+number\b/,
    /\bidentity\s+number\b/,
    /\bdate\s+of\s+birth\b/,
    /\bnationality\b/,
    /\bgender\b/,
  ]);

  const payslipSignals = countMatches(normalized, [
    /\bcompany\s+name\b/,
    /\bemployer\b/,
    /\bemployee\s+name\b/,
    /\bemployee\s+(?:code|number|no\.?)\b/,
    /\bstaff\s+(?:name|number)\b/,
    /\bgross\s+salary\b/,
    /\bgross\s+earnings\b/,
    /\bnet\s+salary\b/,
    /\bnet\s+pay\b/,
    /\btotal\s+deductions\b/,
    /\bpay(?:ment)?\s+date\b/,
    /\bpaye\b/,
    /\buif\b/,
    /\bmedical\s+aid\b/,
  ]);

  const bankStatementSignals = countMatches(normalized, [
    /\bcapitec\b/,
    /\bfnb\b/,
    /\bfirst\s+national\s+bank\b/,
    /\babsa\b/,
    /\bstandard\s+bank\b/,
    /\bnedbank\b/,
    /\bdiscovery\s+bank\b/,
    /\binvestec\b/,
    /\bwesbank\b/,
    /\bwes\s*bank\b/,
    /\btyme\s*bank\b/,
    /\bafrican\s+bank\b/,
    /\baccount\s+holder\b/,
    /\baccount\s+number\b/,
    /\bstatement\s+period\b/,
    /\bclosing\s+balance\b/,
    /\bbank\s+statement\b/,
  ]);

  const ranked = [
    { documentType: "DRIVER_LICENCE" as const, signals: driverLicenceSignals },
    { documentType: "GREEN_ID_BOOK" as const, signals: greenIdSignals },
    { documentType: "SMART_ID_CARD" as const, signals: smartIdSignals },
    { documentType: "SA_ID" as const, signals: saIdSignals },
    { documentType: "PAYSLIP" as const, signals: payslipSignals },
    { documentType: "BANK_STATEMENT" as const, signals: bankStatementSignals },
  ].sort((left, right) => right.signals - left.signals);

  const winner = ranked[0];
  if (!winner || winner.signals === 0) {
    return {
      documentType: "UNKNOWN",
      confidence: 0,
      reasons: ["No classification signals detected"],
    };
  }

  if (winner.documentType === "DRIVER_LICENCE") {
    reasons.push("Detected driver's licence keywords");
  } else if (winner.documentType === "GREEN_ID_BOOK") {
    reasons.push("Detected South African green ID book keywords");
  } else if (winner.documentType === "SMART_ID_CARD") {
    reasons.push("Detected South African smart ID card keywords");
  } else if (winner.documentType === "SA_ID") {
    reasons.push("Detected South African ID keywords");
  } else if (winner.documentType === "PAYSLIP") {
    reasons.push("Detected payslip keywords");
  } else if (winner.documentType === "BANK_STATEMENT") {
    reasons.push("Detected bank statement keywords");
  }

  const runnerUp = ranked[1];
  const confidence = clamp(40 + winner.signals * 15 - Math.max(0, runnerUp?.signals ?? 0) * 5);

  return {
    documentType: winner.documentType,
    confidence,
    reasons,
  };
}

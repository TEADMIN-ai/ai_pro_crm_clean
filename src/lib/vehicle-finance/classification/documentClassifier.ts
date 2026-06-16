export type VehicleFinanceClassifiedDocumentType =
  | "DRIVER_LICENCE"
  | "SA_ID"
  | "PAYSLIP"
  | "BANK_STATEMENT"
  | "UNKNOWN";

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
    /\blicen[cs]e\s+number\b/,
    /\blicen[cs]e\s+code\b/,
    /\bissue(?:d)?\s+date\b/,
    /\bexpiry\s+date\b/,
  ]);

  const saIdSignals = countMatches(normalized, [
    /\bid\s+number\b/,
    /\bidentity\s+number\b/,
    /\bdate\s+of\s+birth\b/,
    /\bnationality\b/,
    /\bgender\b/,
  ]);

  const payslipSignals = countMatches(normalized, [
    /\bgross\s+salary\b/,
    /\bnet\s+salary\b/,
    /\bpay(?:ment)?\s+date\b/,
    /\bemployer\b/,
    /\bemployee\s+number\b/,
  ]);

  const bankStatementSignals = countMatches(normalized, [
    /\baccount\s+holder\b/,
    /\baccount\s+number\b/,
    /\bstatement\s+period\b/,
    /\bclosing\s+balance\b/,
    /\bbank\s+statement\b/,
  ]);

  const ranked = [
    { documentType: "DRIVER_LICENCE" as const, signals: driverLicenceSignals },
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

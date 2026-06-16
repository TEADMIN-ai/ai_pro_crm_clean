export type VehicleFinanceBankName =
  | "CAPITEC"
  | "FNB"
  | "ABSA"
  | "STANDARD_BANK"
  | "NEDBANK"
  | "DISCOVERY"
  | "INVESTEC"
  | "WESBANK"
  | "TYMEBANK"
  | "AFRICAN_BANK"
  | "UNKNOWN_BANK";

export type VehicleFinanceBankStatementClassification = {
  bankName: VehicleFinanceBankName;
  confidence: number;
  reasons: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type BankSignal = {
  bankName: VehicleFinanceBankName;
  patterns: RegExp[];
  reason: string;
};

const BANK_SIGNALS: BankSignal[] = [
  { bankName: "CAPITEC", patterns: [/\bcapitec\b/i], reason: "Detected Capitec branding" },
  { bankName: "FNB", patterns: [/\bfnb\b/i, /\bfirst\s+national\s+bank\b/i], reason: "Detected FNB branding" },
  { bankName: "ABSA", patterns: [/\babsa\b/i], reason: "Detected Absa branding" },
  { bankName: "STANDARD_BANK", patterns: [/\bstandard\s+bank\b/i], reason: "Detected Standard Bank branding" },
  { bankName: "NEDBANK", patterns: [/\bnedbank\b/i], reason: "Detected Nedbank branding" },
  { bankName: "DISCOVERY", patterns: [/\bdiscovery\s+bank\b/i], reason: "Detected Discovery Bank branding" },
  { bankName: "INVESTEC", patterns: [/\binvestec\b/i], reason: "Detected Investec branding" },
  { bankName: "WESBANK", patterns: [/\bwesbank\b/i, /\bwes\s*bank\b/i, /\bvehicle\s+finance\b/i], reason: "Detected WesBank branding" },
  { bankName: "TYMEBANK", patterns: [/\btyme\s*bank\b/i], reason: "Detected TymeBank branding" },
  { bankName: "AFRICAN_BANK", patterns: [/\bafrican\s+bank\b/i], reason: "Detected African Bank branding" },
];

export function classifyBankStatement(text: string): VehicleFinanceBankStatementClassification {
  const normalized = (text ?? "").toLowerCase();
  const matches = BANK_SIGNALS.map((signal) => {
    const hits = signal.patterns.filter((pattern) => pattern.test(normalized)).length;
    return { ...signal, hits };
  }).sort((left, right) => right.hits - left.hits);

  const winner = matches[0];
  if (!winner || winner.hits === 0) {
    return {
      bankName: "UNKNOWN_BANK",
      confidence: 0,
      reasons: ["No bank identifiers detected"],
    };
  }

  const runnerUp = matches[1];
  const confidence = clamp(55 + winner.hits * 15 - Math.max(0, runnerUp?.hits ?? 0) * 5);

  return {
    bankName: winner.bankName,
    confidence,
    reasons: [winner.reason],
  };
}

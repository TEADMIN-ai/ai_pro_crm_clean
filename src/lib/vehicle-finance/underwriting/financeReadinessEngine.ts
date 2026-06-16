import type {
  VehicleFinanceBankStatementIntelligence,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinancePayslipIntelligence,
  VehicleFinanceRiskLevel,
} from "@/types/vehicleFinance";
import { calculateFraudRisk, type VehicleFinanceFraudRiskResult } from "./fraudRiskEngine";
import { calculateEmploymentVerification, type VehicleFinanceEmploymentVerificationResult } from "./employmentVerification";
import { calculateIncomeVerification, type VehicleFinanceIncomeVerificationResult } from "./incomeVerification";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type ReadinessRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type FraudRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

function riskFromScore(score: number, fraudRisk: FraudRiskLevel): ReadinessRiskLevel {
  const isCriticalFraud = String(fraudRisk) === "CRITICAL";
  if (isCriticalFraud) return "CRITICAL";
  if (score >= 85 && String(fraudRisk) === "LOW") return "LOW";
  if (score >= 65 && !isCriticalFraud) return "MEDIUM";
  if (score >= 45) return "HIGH";
  return "CRITICAL";
}

function recommendationFrom(score: number, riskLevel: ReadinessRiskLevel, incomeVerified: boolean, fraudRisk: FraudRiskLevel): "PROCEED" | "REFER" | "DECLINE" {
  if (riskLevel === "CRITICAL" || String(fraudRisk) === "CRITICAL") {
    return "DECLINE";
  }
  if (score >= 80 && incomeVerified && riskLevel === "LOW" && String(fraudRisk) === "LOW") {
    return "PROCEED";
  }
  if (score >= 60) {
    return "REFER";
  }
  return "DECLINE";
}

export type VehicleFinanceFinanceReadinessInput = {
  driverLicence?: VehicleFinanceDriverLicenceIntelligence | null;
  identity?: VehicleFinanceIdentityDocumentIntelligence | null;
  payslip?: VehicleFinancePayslipIntelligence | null;
  bankStatement?: VehicleFinanceBankStatementIntelligence | null;
};

export type VehicleFinanceFinanceReadinessResult = {
  financeReadinessScore: number;
  riskLevel: VehicleFinanceRiskLevel;
  recommendation: "PROCEED" | "REFER" | "DECLINE";
  identityVerificationScore: number;
  licenceVerificationScore: number;
  employmentVerificationScore: number;
  incomeVerificationScore: number;
  bankVerificationScore: number;
  affordabilityScore: number;
  fraudRiskScore: number;
  componentScores: Record<string, number>;
  certificationRequirements: string[];
  incomeVerified: boolean;
  verifiedIncome: number;
  disposableIncome: number;
  recommendedInstalment: number;
  incomeVerification: VehicleFinanceIncomeVerificationResult;
  employmentVerification: VehicleFinanceEmploymentVerificationResult;
  fraudRisk: VehicleFinanceFraudRiskResult["fraudRisk"];
};

export function calculateFinanceReadinessScore(
  input: VehicleFinanceFinanceReadinessInput,
): VehicleFinanceFinanceReadinessResult {
  const identityVerificationScore = clamp(
    input.identity?.verification?.score ??
      input.driverLicence?.crossDocumentVerification?.identityVerificationScore ??
      input.driverLicence?.verification?.score ??
      0,
  );
  const licenceVerificationScore = clamp(input.driverLicence?.verification?.score ?? 0);
  const employmentVerification = calculateEmploymentVerification(
    input.driverLicence,
    input.identity,
    input.payslip,
    input.bankStatement,
  );
  const incomeVerification = calculateIncomeVerification(input.payslip, input.bankStatement);
  const bankVerificationScore = clamp(input.bankStatement?.verification?.verificationScore ?? 0);
  const affordabilityScore = clamp(Number(input.bankStatement?.extraction?.affordability?.affordabilityScore?.value ?? 0));
  const fraudRiskResult = calculateFraudRisk(input.driverLicence, input.identity, input.payslip, input.bankStatement);
  const fraudScore = fraudRiskResult.fraudScore;
  const fraudComponentScore = clamp(100 - fraudScore);

  const financeReadinessScore = clamp(
    Math.round(
      identityVerificationScore * 0.2 +
        licenceVerificationScore * 0.1 +
        employmentVerification.employmentMatchScore * 0.2 +
        incomeVerification.incomeMatchScore * 0.2 +
        bankVerificationScore * 0.15 +
        affordabilityScore * 0.1 +
        fraudComponentScore * 0.05,
    ),
  );

  const riskLevel = riskFromScore(financeReadinessScore, fraudRiskResult.fraudRisk as FraudRiskLevel);
  const recommendation = recommendationFrom(
    financeReadinessScore,
    riskLevel,
    incomeVerification.incomeVerified,
    fraudRiskResult.fraudRisk as FraudRiskLevel,
  );

  const disposableIncome = Number(input.bankStatement?.extraction?.affordability?.disposableIncome?.value ?? 0) || 0;
  const recommendedInstalment = Number(input.bankStatement?.extraction?.affordability?.maxAffordableInstalment?.value ?? 0) || 0;

  const certificationRequirements: string[] = [];
  if (identityVerificationScore < 80) certificationRequirements.push("Identity verification review");
  if (licenceVerificationScore < 80) certificationRequirements.push("Licence verification review");
  if (!employmentVerification.employmentVerified) certificationRequirements.push("Employment verification review");
  if (!incomeVerification.incomeVerified) certificationRequirements.push("Income verification review");
  if (bankVerificationScore < 80) certificationRequirements.push("Bank verification review");
  if (affordabilityScore < 70) certificationRequirements.push("Affordability review");
  if (fraudRiskResult.fraudRisk !== "LOW") certificationRequirements.push("Fraud review");
  if (!certificationRequirements.length) {
    certificationRequirements.push("All certification requirements satisfied");
  }

  return {
    financeReadinessScore,
    riskLevel: riskLevel as VehicleFinanceRiskLevel,
    recommendation,
    identityVerificationScore,
    licenceVerificationScore,
    employmentVerificationScore: employmentVerification.employmentMatchScore,
    incomeVerificationScore: incomeVerification.incomeMatchScore,
    bankVerificationScore,
    affordabilityScore,
    fraudRiskScore: fraudScore,
    componentScores: {
      identity: identityVerificationScore,
      licence: licenceVerificationScore,
      employment: employmentVerification.employmentMatchScore,
      income: incomeVerification.incomeMatchScore,
      bank: bankVerificationScore,
      affordability: affordabilityScore,
      fraud: fraudComponentScore,
    },
    certificationRequirements,
    incomeVerified: incomeVerification.incomeVerified,
    verifiedIncome: Number(input.payslip?.extraction?.netPay?.value ?? input.payslip?.extraction?.grossEarnings?.value ?? 0) || 0,
    disposableIncome,
    recommendedInstalment,
    incomeVerification,
    employmentVerification,
    fraudRisk: fraudRiskResult.fraudRisk,
  };
}

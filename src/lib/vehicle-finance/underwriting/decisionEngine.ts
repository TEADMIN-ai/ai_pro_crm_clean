import type {
  VehicleFinanceBankStatementIntelligence,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinancePayslipIntelligence,
} from "@/types/vehicleFinance";
import {
  calculateFinanceReadinessScore,
  type VehicleFinanceFinanceReadinessInput,
  type VehicleFinanceFinanceReadinessResult,
} from "./financeReadinessEngine";
import { calculateFraudRisk } from "./fraudRiskEngine";
import { calculateIncomeVerification } from "./incomeVerification";
import { calculateEmploymentVerification } from "./employmentVerification";

export type VehicleFinanceDecisionInput = VehicleFinanceFinanceReadinessInput;

export type VehicleFinanceDecisionResult = VehicleFinanceFinanceReadinessResult & {
  recommendedDecision: "PROCEED" | "REFER" | "DECLINE";
  decisionReason: string;
};

export function buildVehicleFinanceDecision(
  input: VehicleFinanceDecisionInput,
): VehicleFinanceDecisionResult {
  const readiness = calculateFinanceReadinessScore(input);
  const fraudRisk = calculateFraudRisk(input.driverLicence, input.identity, input.payslip, input.bankStatement);
  const incomeVerification = calculateIncomeVerification(input.payslip, input.bankStatement);
  const employmentVerification = calculateEmploymentVerification(
    input.driverLicence,
    input.identity,
    input.payslip,
    input.bankStatement,
  );

  let recommendedDecision: "PROCEED" | "REFER" | "DECLINE" = readiness.recommendation;
  let decisionReason = "Identity, income and affordability successfully verified.";

  if (fraudRisk.fraudRisk === "CRITICAL") {
    recommendedDecision = "DECLINE";
    decisionReason = "Critical fraud risk detected.";
  } else if (!incomeVerification.incomeVerified) {
    recommendedDecision = "REFER";
    decisionReason = "Income verification requires manual review.";
  } else if (!employmentVerification.employmentVerified) {
    recommendedDecision = "REFER";
    decisionReason = "Employment verification requires manual review.";
  } else if (readiness.financeReadinessScore < 80) {
    recommendedDecision = "REFER";
    decisionReason = "Overall finance readiness requires review.";
  } else if (readiness.financeReadinessScore < 65) {
    recommendedDecision = "DECLINE";
    decisionReason = "Finance readiness below acceptable threshold.";
  }

  if (recommendedDecision === "PROCEED") {
    decisionReason = "Identity, income and affordability successfully verified.";
  }

  return {
    ...readiness,
    incomeVerification: incomeVerification,
    employmentVerification: employmentVerification,
    fraudRisk: fraudRisk.fraudRisk,
    fraudRiskScore: fraudRisk.fraudScore,
    recommendedDecision,
    decisionReason,
  };
}

export function buildVehicleFinanceDecisionFromIntelligence(
  input: {
    driverLicence?: VehicleFinanceDriverLicenceIntelligence | null;
    identity?: VehicleFinanceIdentityDocumentIntelligence | null;
    payslip?: VehicleFinancePayslipIntelligence | null;
    bankStatement?: VehicleFinanceBankStatementIntelligence | null;
  },
): VehicleFinanceDecisionResult {
  return buildVehicleFinanceDecision(input);
}


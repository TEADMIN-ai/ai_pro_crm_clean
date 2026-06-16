import type {
  VehicleFinanceBankAffordability,
  VehicleFinanceBankCommitmentSummary,
  VehicleFinanceBankGamblingRisk,
  VehicleFinanceBankSalaryIntelligence,
} from "@/types/vehicleFinance";
import { field } from "../banks/bankTemplateUtils";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateVehicleFinanceAffordability(
  salary: VehicleFinanceBankSalaryIntelligence,
  commitments: VehicleFinanceBankCommitmentSummary,
  gamblingRisk: VehicleFinanceBankGamblingRisk,
): VehicleFinanceBankAffordability {
  const grossIncome = Number(salary.averageSalary.value ?? 0) || 0;
  const monthlyCommitments = Number(commitments.totalMonthlyCommitments.value ?? 0) || 0;
  const gamblingSpend = Number(gamblingRisk.gamblingSpend.value ?? 0) || 0;
  const netIncome = Math.max(0, grossIncome - monthlyCommitments);
  const disposableIncome = Math.max(0, netIncome - gamblingSpend);
  const salaryConsistency = Number(salary.salaryConsistency.value ?? 0) || 0;
  const gamblingPenalty =
    gamblingRisk.riskLevel === "CRITICAL" ? 30 : gamblingRisk.riskLevel === "HIGH" ? 20 : gamblingRisk.riskLevel === "MEDIUM" ? 10 : 0;
  const affordabilityScore = clamp(
    Math.round(
      Math.max(0, grossIncome > 0 ? (disposableIncome / grossIncome) * 100 : 0) +
        Math.max(0, salaryConsistency * 0.25) -
        gamblingPenalty,
    ),
  );
  const maxAffordableInstalment = clamp(Math.min(disposableIncome * 0.35, grossIncome * 0.25));
  const starterVehicle = `Starter vehicle band up to R ${Math.round(maxAffordableInstalment * 6)}`;
  const midRangeVehicle = `Mid-range vehicle band up to R ${Math.round(maxAffordableInstalment * 12)}`;
  const premiumVehicle = `Premium vehicle band above R ${Math.round(maxAffordableInstalment * 12)}`;

  const sourceText = [salary.averageSalary.sourceText, commitments.totalMonthlyCommitments.sourceText, gamblingRisk.gamblingSpend.sourceText]
    .filter(Boolean)
    .join(" | ");

  return {
    grossIncome: field(grossIncome, salary.averageSalary.confidence, sourceText),
    netIncome: field(netIncome, commitments.totalMonthlyCommitments.confidence, sourceText),
    monthlyCommitments: field(monthlyCommitments, commitments.totalMonthlyCommitments.confidence, sourceText),
    disposableIncome: field(disposableIncome, salary.averageSalary.confidence, sourceText),
    affordabilityScore: field(affordabilityScore, affordabilityScore, sourceText),
    maxAffordableInstalment: field(maxAffordableInstalment, affordabilityScore, sourceText),
    starterVehicle: field(starterVehicle, affordabilityScore, sourceText),
    midRangeVehicle: field(midRangeVehicle, affordabilityScore, sourceText),
    premiumVehicle: field(premiumVehicle, affordabilityScore, sourceText),
  };
}


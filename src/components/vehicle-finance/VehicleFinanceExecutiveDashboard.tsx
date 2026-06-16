"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { buildVehicleFinanceDecisionFromIntelligence } from "@/lib/vehicle-finance/underwriting/decisionEngine";
import { calculateVehicleFinanceAffordability } from "@/lib/vehicle-finance/affordability/vehicleFinanceAffordability";
import type {
  VehicleFinanceApplication,
  VehicleFinanceBankStatementIntelligence,
  VehicleFinanceCertificate,
  VehicleFinanceCustomer,
  VehicleFinanceDocument,
  VehicleFinanceDocumentAnalysis,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinancePayslipIntelligence,
} from "@/types/vehicleFinance";

type VehicleFinanceOverview = {
  metrics: {
    totalApplications: number;
    pendingVerification: number;
    verifiedApplications: number;
    fraudAlerts: number;
    approvalRatio: number;
    monthlyDealValue: number;
  };
  customers: VehicleFinanceCustomer[];
  applications: VehicleFinanceApplication[];
  documents: VehicleFinanceDocument[];
  assessments: Array<{
    applicationId: string;
    overallFraudScore: number;
    riskLevel: string;
  }>;
  certificates: VehicleFinanceCertificate[];
};

function formatCurrency(value: number | null | undefined): string {
  return `R ${Number(value ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

function getCustomerName(customer?: VehicleFinanceCustomer | null): string {
  if (!customer) {
    return "Unknown Customer";
  }

  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "Unknown Customer";
}

function getStatusTone(status: string | undefined): "success" | "warning" | "danger" {
  if (!status) {
    return "warning";
  }

  if (status === "VERIFIED" || status === "PROCEED") {
    return "success";
  }

  if (status === "DECLINE" || status === "REJECTED" || status === "HIGH" || status === "CRITICAL") {
    return "danger";
  }

  return "warning";
}

export default function VehicleFinanceExecutiveDashboard() {
  const [overview, setOverview] = useState<VehicleFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();

    authFetch(API_ROUTES.VEHICLE_FINANCE_OVERVIEW, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Vehicle finance overview request failed (${response.status})`);
        }

        return response.json() as Promise<VehicleFinanceOverview>;
      })
      .then((payload) => {
        setOverview(payload);
        setError(null);
      })
      .catch((loadError: unknown) => {
        setOverview(null);
        setError(loadError instanceof Error ? loadError.message : "Vehicle finance overview unavailable");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedApplicationId && overview?.applications.length) {
      setSelectedApplicationId(overview.applications[0].applicationId);
    }
  }, [overview?.applications, selectedApplicationId]);

  const customerById = useMemo(() => {
    return new Map((overview?.customers ?? []).map((customer) => [customer.customerId, customer]));
  }, [overview?.customers]);

  const selectedApplication = useMemo(() => {
    const applications = overview?.applications ?? [];
    if (!applications.length) {
      return null;
    }

    return applications.find((application) => application.applicationId === selectedApplicationId) ?? applications[0];
  }, [overview?.applications, selectedApplicationId]);

  const selectedCustomer = useMemo(() => {
    if (!selectedApplication) {
      return null;
    }

    return customerById.get(selectedApplication.customerId) ?? null;
  }, [customerById, selectedApplication]);

  const selectedDocuments = useMemo(() => {
    if (!selectedApplication) {
      return [];
    }

    return (overview?.documents ?? []).filter((document) => document.applicationId === selectedApplication.applicationId);
  }, [overview?.documents, selectedApplication]);

  const selectedDriverLicenceIntelligence = useMemo(
    () => (selectedDocuments.find((document) => document.documentType === "driversLicense")?.aiAnalysis as VehicleFinanceDocumentAnalysis | undefined)?.driverLicenceIntelligence ?? null,
    [selectedDocuments],
  );

  const selectedIdentityIntelligence = useMemo(
    () => {
      const identityDocument = selectedDocuments.find((document) => document.documentType === "greenIdBook" || document.documentType === "smartIdCard" || document.documentType === "saIdDocument");
      return (identityDocument?.aiAnalysis as VehicleFinanceDocumentAnalysis | undefined)?.identityIntelligence ?? null;
    },
    [selectedDocuments],
  );

  const selectedPayslipIntelligence = useMemo(
    () => (selectedDocuments.find((document) => document.documentType === "payslip")?.aiAnalysis as VehicleFinanceDocumentAnalysis | undefined)?.payslipIntelligence ?? null,
    [selectedDocuments],
  );

  const selectedBankStatementIntelligence = useMemo(
    () => (selectedDocuments.find((document) => document.documentType === "bankStatement")?.aiAnalysis as VehicleFinanceDocumentAnalysis | undefined)?.bankStatementIntelligence ?? null,
    [selectedDocuments],
  );

  const financeDecision = useMemo(
    () =>
      buildVehicleFinanceDecisionFromIntelligence({
        driverLicence: selectedDriverLicenceIntelligence as VehicleFinanceDriverLicenceIntelligence | null,
        identity: selectedIdentityIntelligence as VehicleFinanceIdentityDocumentIntelligence | null,
        payslip: selectedPayslipIntelligence as VehicleFinancePayslipIntelligence | null,
        bankStatement: selectedBankStatementIntelligence as VehicleFinanceBankStatementIntelligence | null,
      }),
    [
      selectedDriverLicenceIntelligence,
      selectedIdentityIntelligence,
      selectedPayslipIntelligence,
      selectedBankStatementIntelligence,
    ],
  );

  const affordability = useMemo(() => {
    const bankExtraction = selectedBankStatementIntelligence?.extraction;
    const salary = bankExtraction?.salaryIntelligence;
    const commitments = bankExtraction?.commitmentSummary;
    const gamblingRisk = bankExtraction?.gamblingRisk;

    if (salary && commitments && gamblingRisk) {
      return calculateVehicleFinanceAffordability(salary, commitments, gamblingRisk);
    }

    return bankExtraction?.affordability ?? null;
  }, [selectedBankStatementIntelligence]);

  const totalApplications = overview?.metrics.totalApplications ?? 0;
  const averageIncome = selectedCustomer?.monthlyIncome ?? Number(selectedPayslipIntelligence?.extraction.netPay.value ?? 0);
  const incomeVerificationScore = financeDecision.incomeVerificationScore;
  const employmentVerificationScore = financeDecision.employmentVerificationScore;
  const fraudScore = financeDecision.fraudRiskScore;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 text-slate-200">
        <Card>
          <IdentityCardHeader title="Vehicle Finance Intelligence" subtitle="Loading Roar Cars SA command center..." />
          <p className="mt-4 text-sm text-slate-400">Preparing executive dashboard.</p>
        </Card>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 text-slate-200">
        <Card>
          <IdentityCardHeader title="Vehicle Finance Intelligence" subtitle="Executive dashboard unavailable" />
          <p className="mt-4 text-sm text-slate-300">{error ?? "No data available."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(4,12,25,0.98),rgba(6,14,29,0.96))] px-6 py-6 shadow-[0_24px_80px_rgba(2,8,23,0.4)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/75">
              TORQUE EMPIRE
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-5xl">
              Vehicle Finance Intelligence
            </h1>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
              In partnership with Roar Cars SA, Born to Roar
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Dedicated dealership-facing command center for finance pre-approval, verification, affordability, and decisioning.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <Link href="/dashboard/vehicle-finance/customers" className="rounded-[22px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-left no-underline transition hover:bg-cyan-400/15">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">Customers</p>
              <p className="mt-3 text-2xl font-semibold text-white">{overview.customers.length}</p>
            </Link>
            <Link href="/dashboard/vehicle-finance/applications" className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 text-left no-underline transition hover:bg-white/[0.06]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Applications</p>
              <p className="mt-3 text-2xl font-semibold text-white">{totalApplications}</p>
            </Link>
            <Link href="/dashboard/vehicle-finance/reports" className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-left no-underline transition hover:bg-emerald-400/15">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/75">Reports</p>
              <p className="mt-3 text-2xl font-semibold text-white">{overview.metrics.approvalRatio}%</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance Readiness Score</p>
          <p className="mt-3 text-3xl font-semibold text-white">{financeDecision.financeReadinessScore}</p>
          <p className="mt-2 text-sm text-slate-400">{financeDecision.riskLevel}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk Level</p>
          <Badge tone={getStatusTone(financeDecision.riskLevel)}>{financeDecision.riskLevel}</Badge>
          <p className="mt-3 text-sm text-slate-400">Fraud score: {fraudScore}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Decision</p>
          <Badge tone={getStatusTone(financeDecision.recommendedDecision)}>{financeDecision.recommendedDecision}</Badge>
          <p className="mt-3 text-sm text-slate-400">Reason: {financeDecision.decisionReason}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maximum Affordable Instalment</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(affordability?.maxAffordableInstalment?.value as number | null | undefined)}</p>
          <p className="mt-2 text-sm text-slate-400">Disposable income: {formatCurrency(affordability?.disposableIncome?.value as number | null | undefined)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verified Income</p>
          <p className="mt-3 text-3xl font-semibold text-white">{financeDecision.incomeVerified ? "YES" : "NO"}</p>
          <p className="mt-2 text-sm text-slate-400">Income match: {incomeVerificationScore}%</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <IdentityCardHeader title="Verification Panel" subtitle="Identity, licence, employment, income, bank, affordability">
            <div className="flex flex-wrap gap-2">
              <Badge tone={getStatusTone(financeDecision.recommendation)}>{financeDecision.recommendation}</Badge>
            </div>
          </IdentityCardHeader>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Identity Verification", selectedIdentityIntelligence?.verification?.score ?? 0],
              ["Driver Licence Verification", selectedDriverLicenceIntelligence?.verification?.score ?? 0],
              ["Employment Verification", employmentVerificationScore],
              ["Income Verification", incomeVerificationScore],
              ["Bank Verification", selectedBankStatementIntelligence?.verification?.verificationScore ?? 0],
              ["Affordability Verification", affordability?.affordabilityScore?.value ?? 0],
            ].map(([label, score]) => (
              <div key={label as string} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label as string}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{score as number}%</p>
                <p className="mt-1 text-xs text-slate-400">
                  {score && (score as number) >= 80 ? "Verified" : (score as number) >= 50 ? "Pending" : "Failed"}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Underwriting Panel" subtitle="Decisioning and match signals" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance Readiness Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{financeDecision.financeReadinessScore}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fraud Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{fraudScore}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Income Match Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{financeDecision.incomeVerificationScore}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employment Match Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{financeDecision.employmentVerificationScore}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision</p>
              <p className="mt-2 text-xl font-semibold text-white">{financeDecision.recommendedDecision}</p>
              <p className="mt-2 text-sm text-slate-400">{financeDecision.decisionReason}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <IdentityCardHeader title="Income & Commitments" subtitle="Salary, obligations, and disposable income" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average Monthly Income</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(averageIncome)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salary Consistency</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {selectedBankStatementIntelligence?.extraction.salaryIntelligence?.salaryConsistency?.value ?? selectedPayslipIntelligence?.extraction.payPeriod.value ?? "n/a"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly Debt Commitments</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(selectedBankStatementIntelligence?.extraction.commitmentSummary?.totalMonthlyCommitments?.value as number | null | undefined)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disposable Income</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(affordability?.disposableIncome?.value as number | null | undefined)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Insurance Commitments</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(selectedBankStatementIntelligence?.extraction.commitmentSummary?.monthlyInsuranceCommitments?.value as number | null | undefined)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Retail Credit Commitments</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(selectedBankStatementIntelligence?.extraction.commitmentSummary?.monthlyDebtCommitments?.value as number | null | undefined)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Fraud Panel" subtitle="Gambling, integrity, and consistency signals" />
          {(() => {
            const fraudIndicators = [
              ...(selectedDriverLicenceIntelligence?.verification?.flags ?? []),
              ...(selectedIdentityIntelligence?.verification?.flags ?? []),
              ...(selectedBankStatementIntelligence?.verification?.flags ?? []),
              ...(selectedBankStatementIntelligence?.extraction?.gamblingRisk?.flags ?? []),
              ...(financeDecision.incomeVerification?.flags ?? []),
              ...(financeDecision.employmentVerification?.flags ?? []),
              financeDecision.fraudRisk !== "LOW" ? financeDecision.fraudRisk : null,
            ].filter((flag): flag is string => Boolean(flag));

            return (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fraud Risk Score</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{fraudScore}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gambling Risk</p>
                  <Badge tone={getStatusTone(selectedBankStatementIntelligence?.extraction.gamblingRisk?.riskLevel)}>{selectedBankStatementIntelligence?.extraction.gamblingRisk?.riskLevel ?? "LOW"}</Badge>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Income Consistency</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {selectedBankStatementIntelligence?.extraction.salaryIntelligence?.salaryConsistency?.value ?? selectedPayslipIntelligence?.extraction.grossEarnings.value ?? "n/a"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Integrity</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedDocuments.length > 0 ? "CHECKED" : "PENDING"}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fraud Indicators</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fraudIndicators.length ? (
                      fraudIndicators.slice(0, 8).map((flag) => (
                        <Badge key={flag} tone="warning">
                          {flag}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="success">No fraud indicators</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <IdentityCardHeader title="Vehicle Affordability" subtitle="Recommended instalment and vehicle band guidance" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Instalment</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(affordability?.maxAffordableInstalment?.value as number | null | undefined)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Starter Vehicle Band</p>
              <p className="mt-2 text-sm text-white">{affordability?.starterVehicle?.value ?? "n/a"}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mid Range Vehicle Band</p>
              <p className="mt-2 text-sm text-white">{affordability?.midRangeVehicle?.value ?? "n/a"}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Premium Vehicle Band</p>
              <p className="mt-2 text-sm text-white">{affordability?.premiumVehicle?.value ?? "n/a"}</p>
            </div>
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Application Workspace" subtitle="Featured customer and case summary" />
          <label className="mt-4 block text-sm text-slate-300">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Application</span>
            <select
              value={selectedApplication?.applicationId ?? ""}
              onChange={(event) => setSelectedApplicationId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {overview.applications.map((application) => (
                <option key={application.applicationId} value={application.applicationId}>
                  {application.applicationId} - {application.dealerName}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customer Name</p>
              <p className="mt-2 text-lg font-semibold text-white">{getCustomerName(selectedCustomer)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Application Number</p>
              <p className="mt-2 text-sm text-white">{selectedApplication?.applicationId ?? "n/a"}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vehicle Requested</p>
              <p className="mt-2 text-sm text-white">{selectedApplication?.vehicleId ?? "n/a"}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Application Status</p>
              <Badge tone={getStatusTone(selectedApplication?.applicationStatus)}>{selectedApplication?.applicationStatus ?? "n/a"}</Badge>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance Readiness Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{financeDecision.financeReadinessScore}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk Level</p>
              <Badge tone={getStatusTone(financeDecision.riskLevel)}>{financeDecision.riskLevel}</Badge>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision</p>
              <p className="mt-2 text-lg font-semibold text-white">{financeDecision.recommendedDecision}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <IdentityCardHeader title="Dealer Reports" subtitle="Operational summary for Roar Cars SA" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Applications Processed", overview.metrics.totalApplications],
              ["Approved", overview.metrics.verifiedApplications],
              ["Referred", overview.metrics.pendingVerification],
              ["Declined", overview.applications.filter((application) => application.applicationStatus === "REJECTED").length],
              ["Average Readiness Score", financeDecision.financeReadinessScore],
              ["Average Income", selectedCustomer?.monthlyIncome ?? 0],
              ["Average Instalment", affordability?.maxAffordableInstalment?.value ?? 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label as string}</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {typeof value === "number" ? value.toLocaleString("en-ZA") : String(value)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Certification Requirements" subtitle="Operational readiness for Roar Cars SA onboarding" />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Driver Licence Upload",
              "Identity Upload",
              "Payslip Upload",
              "Bank Statement Upload",
              "Cross Verification",
              "Affordability",
              "Underwriting",
              "Finance Readiness",
              "Decision Engine",
              "Dashboard Rendering",
              "Async Jobs",
              "No 500 Errors",
              "No 504 Errors",
              "No Regressions",
            ].map((item) => (
              <Badge key={item} tone="warning">
                {item}
              </Badge>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

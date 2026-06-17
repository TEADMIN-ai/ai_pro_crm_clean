"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
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

const DEFAULT_OVERVIEW: VehicleFinanceOverview = {
  metrics: {
    totalApplications: 0,
    pendingVerification: 0,
    verifiedApplications: 0,
    fraudAlerts: 0,
    approvalRatio: 0,
    monthlyDealValue: 0,
  },
  customers: [],
  applications: [],
  documents: [],
  assessments: [],
  certificates: [],
};

const HERO_VIDEO_SRC = "/images/vehicles/bmw-m5-hero.mp4";
const HERO_POSTER_SRC = "/images/vehicles/bmw-m4-hero.jpg";
const PARTNERSHIP_LOGO_SRC = "/images/logos/TE IN Partnership With Roar logo.png";
const EXECUTIVE_METRIC_CARD_CLASS =
  "min-h-[152px] rounded-[24px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md shadow-[0_18px_45px_rgba(2,8,23,0.18)]";
const SUPPORTING_STAT_CARD_CLASS = "rounded-xl border border-slate-700 bg-slate-950/60 p-4";

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
  const dashboard = overview ?? DEFAULT_OVERVIEW;
  const applicationSummaryMetrics = [
    ["Applications Today", dashboard.metrics.totalApplications],
    ["Pending Verification", dashboard.metrics.pendingVerification],
    ["Approved", dashboard.metrics.verifiedApplications],
    ["Declined", dashboard.applications.filter((application) => application.applicationStatus === "REJECTED").length],
    ["Average Affordability", affordability?.affordabilityScore?.value ?? financeDecision.financeReadinessScore],
  ] as const;

  const featuredVehicles = [
    {
      title: "BMW M4 Competition",
      subtitle: "Executive hero vehicle",
      image: "/images/vehicles/bmw-m4-transparent.png",
      accent: "bg-cyan-400/10",
    },
    {
      title: "VW Golf R32",
      subtitle: "Featured vehicle",
      image: "/images/vehicles/vw-golf-r32.png",
      accent: "bg-white/5",
    },
  ] as const;

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

  return (
    <div className="relative isolate mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-16 z-0 flex justify-center overflow-hidden">
        <Image
          src={PARTNERSHIP_LOGO_SRC}
          alt=""
          width={1800}
          height={520}
          className="h-auto w-[clamp(1080px,150vw,1800px)] select-none object-contain opacity-[0.14]"
          priority
        />
      </div>

      {error ? (
        <Card className="relative z-10">
          <IdentityCardHeader title="Vehicle Finance Intelligence" subtitle="Executive dashboard unavailable" />
          <p className="mt-4 text-sm text-slate-300">{error}</p>
        </Card>
      ) : null}

      <section className="relative z-10 overflow-hidden rounded-[32px] border border-cyan-400/20 bg-slate-950 shadow-[0_24px_90px_rgba(2,8,23,0.45)] lg:min-h-[760px]">
        <div className="absolute inset-0">
          <video
            className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_POSTER_SRC}
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.94)_0%,rgba(3,12,25,0.9)_46%,rgba(2,8,23,0.78)_100%)]" />
          <div
            className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] opacity-30"
            style={{ animation: "pulse 12s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%)]" />
        </div>

        <div className="relative grid gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-8 lg:py-14">
          <div className="flex flex-col justify-between gap-8">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 rounded-full border border-cyan-300/20 bg-slate-950/50 px-4 py-2 backdrop-blur-md">
                  <Image
                    src={PARTNERSHIP_LOGO_SRC}
                    alt="Torque Empire in partnership with Roar Cars SA"
                    width={184}
                    height={36}
                    className="h-7 w-auto"
                    priority
                  />
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-100/80 backdrop-blur-md">
                  Roar Cars SA Executive Portal
                </div>
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                ROAR CARS SA EXECUTIVE PORTAL
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
                Vehicle Finance Intelligence
              </h1>
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-cyan-100/75">
                Powered by Torque Empire
              </p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200/85 lg:text-lg">
                Dedicated dealership-facing command center for finance pre-approval, verification, affordability, underwriting, and decisioning.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link href="/dashboard/vehicle-finance/customers" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:bg-cyan-300/15`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">Customers</p>
                <p className="mt-3 text-2xl font-semibold text-white">{dashboard.customers.length}</p>
              </Link>
              <Link href="/dashboard/vehicle-finance/applications" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:bg-white/[0.1]`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Applications</p>
                <p className="mt-3 text-2xl font-semibold text-white">{totalApplications}</p>
              </Link>
              <Link href="/dashboard/vehicle-finance/reports" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:bg-emerald-300/15`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">Reports</p>
                <p className="mt-3 text-2xl font-semibold text-white">{dashboard.metrics.approvalRatio}%</p>
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[440px] items-end justify-center lg:min-h-[720px] lg:justify-end">
            <div className="flex w-full max-w-[760px] flex-col gap-4 pt-2 lg:pt-0">
              <div className="flex justify-end">
                <DashboardHeader />
              </div>
              <div className="absolute inset-x-6 bottom-0 top-20 rounded-[40px] border border-cyan-300/10 bg-cyan-300/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-slate-950/50 p-4 shadow-[0_28px_100px_rgba(2,8,23,0.45)] backdrop-blur-md lg:p-6">
                <div className="relative aspect-[16/11] w-full lg:scale-[1.22] lg:origin-bottom">
                  <Image
                    src="/images/vehicles/bmw-m4-transparent.png"
                    alt="BMW M4 hero vehicle"
                    fill
                    sizes="(min-width: 1024px) 55vw, 92vw"
                    className="object-contain object-bottom drop-shadow-[0_24px_45px_rgba(15,23,42,0.7)]"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {applicationSummaryMetrics.map(([label, value]) => (
          <Card key={label} className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {typeof value === "number" ? value.toLocaleString("en-ZA") : String(value)}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance Readiness Score</p>
          <p className="mt-3 text-3xl font-semibold text-white">{financeDecision.financeReadinessScore}</p>
          <p className="mt-2 text-sm text-slate-400">{financeDecision.riskLevel}</p>
        </Card>
        <Card className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk Level</p>
          <Badge tone={getStatusTone(financeDecision.riskLevel)}>{financeDecision.riskLevel}</Badge>
          <p className="mt-3 text-sm text-slate-400">Fraud score: {fraudScore}</p>
        </Card>
        <Card className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Underwriting</p>
          <Badge tone={getStatusTone(financeDecision.recommendedDecision)}>{financeDecision.recommendedDecision}</Badge>
          <p className="mt-3 text-sm text-slate-400">Reason: {financeDecision.decisionReason}</p>
        </Card>
        <Card className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Maximum Affordable Instalment</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(affordability?.maxAffordableInstalment?.value as number | null | undefined)}</p>
          <p className="mt-2 text-sm text-slate-400">Disposable income: {formatCurrency(affordability?.disposableIncome?.value as number | null | undefined)}</p>
        </Card>
        <Card className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verified Income</p>
          <p className="mt-3 text-3xl font-semibold text-white">{financeDecision.incomeVerified ? "YES" : "NO"}</p>
          <p className="mt-2 text-sm text-slate-400">Income match: {incomeVerificationScore}%</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <IdentityCardHeader title="Featured Vehicles" subtitle="Ready for future inventory integration" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {featuredVehicles.map((vehicle) => (
              <article key={vehicle.title} className={`overflow-hidden rounded-[28px] border border-white/10 ${vehicle.accent} shadow-[0_20px_50px_rgba(2,8,23,0.22)]`}>
                <div className="relative aspect-[16/9] bg-slate-950/70 p-3 md:p-5">
                  <Image
                    src={vehicle.image}
                    alt={vehicle.title}
                    fill
                    sizes="(min-width: 768px) 44vw, 92vw"
                    className="object-contain object-center p-2 md:p-3 lg:p-4"
                  />
                </div>
                <div className="border-t border-white/10 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">{vehicle.subtitle}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{vehicle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Vehicle card styling prepared for Roar Cars SA inventory integration.</p>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Dealership Metrics" subtitle="Operational snapshot for Roar Cars SA" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Applications Today", dashboard.metrics.totalApplications],
              ["Pending Verification", dashboard.metrics.pendingVerification],
              ["Approved", dashboard.metrics.verifiedApplications],
              ["Declined", dashboard.applications.filter((application) => application.applicationStatus === "REJECTED").length],
              ["Average Affordability", affordability?.affordabilityScore?.value ?? financeDecision.financeReadinessScore],
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
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average Monthly Income</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(averageIncome)}</p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salary Consistency</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {String(
                  selectedBankStatementIntelligence?.extraction.salaryIntelligence?.salaryConsistency?.value ??
                    selectedPayslipIntelligence?.extraction.payPeriod?.value ??
                    "n/a",
                )}
              </p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly Debt Commitments</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(selectedBankStatementIntelligence?.extraction.commitmentSummary?.totalMonthlyCommitments?.value as number | null | undefined)}
              </p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disposable Income</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(affordability?.disposableIncome?.value as number | null | undefined)}</p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Insurance Commitments</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(selectedBankStatementIntelligence?.extraction.commitmentSummary?.monthlyInsuranceCommitments?.value as number | null | undefined)}
              </p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
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
                <div className={SUPPORTING_STAT_CARD_CLASS}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fraud Risk Score</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{fraudScore}</p>
                </div>
                <div className={SUPPORTING_STAT_CARD_CLASS}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gambling Risk</p>
                  <Badge tone={getStatusTone(selectedBankStatementIntelligence?.extraction.gamblingRisk?.riskLevel)}>{selectedBankStatementIntelligence?.extraction.gamblingRisk?.riskLevel ?? "LOW"}</Badge>
                </div>
                <div className={SUPPORTING_STAT_CARD_CLASS}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Income Consistency</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {String(
                      selectedBankStatementIntelligence?.extraction.salaryIntelligence?.salaryConsistency?.value ??
                        selectedPayslipIntelligence?.extraction.grossEarnings?.value ??
                        "n/a",
                    )}
                  </p>
                </div>
                <div className={SUPPORTING_STAT_CARD_CLASS}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document Integrity</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedDocuments.length > 0 ? "CHECKED" : "PENDING"}</p>
                </div>
                <div className={`${SUPPORTING_STAT_CARD_CLASS} sm:col-span-2`}>
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
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Instalment</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(affordability?.maxAffordableInstalment?.value as number | null | undefined)}</p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Starter Vehicle Band</p>
              <p className="mt-2 text-sm text-white">{affordability?.starterVehicle?.value ?? "n/a"}</p>
            </div>
            <div className={SUPPORTING_STAT_CARD_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mid Range Vehicle Band</p>
              <p className="mt-2 text-sm text-white">{affordability?.midRangeVehicle?.value ?? "n/a"}</p>
            </div>
            <div className={`${SUPPORTING_STAT_CARD_CLASS} sm:col-span-3`}>
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
              {dashboard.applications.map((application) => (
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
              ["Applications Processed", dashboard.metrics.totalApplications],
              ["Approved", dashboard.metrics.verifiedApplications],
              ["Referred", dashboard.metrics.pendingVerification],
              ["Declined", dashboard.applications.filter((application) => application.applicationStatus === "REJECTED").length],
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

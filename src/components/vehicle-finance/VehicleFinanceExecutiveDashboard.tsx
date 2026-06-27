"use client";

import Link from "next/link";
import Image from "next/image";
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
import type { RoarInventoryResponse } from "@/types/roarInventory";

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

const ROAR_SHOWROOM_SRC = "/images/roar-cars-showroom.jpg";
const EXECUTIVE_METRIC_CARD_CLASS =
  "min-h-[152px] rounded-[24px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md shadow-[0_18px_45px_rgba(2,8,23,0.18)]";
const SUPPORTING_STAT_CARD_CLASS = "rounded-xl border border-slate-700 bg-slate-950/60 p-4";

function formatCurrency(value: number | null | undefined): string {
  return `R ${Number(value ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

function formatSyncedAt(value?: string | null): string {
  if (!value) {
    return "Not synced yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not synced yet";
  }

  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [inventory, setInventory] = useState<RoarInventoryResponse | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
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
    const controller = new AbortController();
    authFetch(API_ROUTES.VEHICLE_FINANCE_ROAR_INVENTORY, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Roar inventory request failed (${response.status})`);
        return response.json() as Promise<RoarInventoryResponse>;
      })
      .then(setInventory)
      .catch((inventoryError: unknown) => {
        if (!controller.signal.aborted) {
          setInventoryError(inventoryError instanceof Error ? inventoryError.message : "Roar inventory unavailable");
          console.warn("[vehicle-finance] Roar inventory unavailable", inventoryError);
        }
      });
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
  const inventoryVehicles = inventory?.vehicles.filter((vehicle) => !/sold|inactive|reserved|unavailable/i.test(vehicle.status)) ?? [];
  const highestPriceVehicle = [...inventoryVehicles].sort((left, right) => (right.priceNumber ?? right.price ?? 0) - (left.priceNumber ?? left.price ?? 0))[0];
  const newestYearVehicle = [...inventoryVehicles].sort((left, right) => (right.year ?? 0) - (left.year ?? 0))[0];
  const inventoryMetrics = [
    ["Total Vehicles", inventory?.itemCount ?? 0],
    ["Active Listings", inventory?.metrics.activeVehicles ?? 0],
    ["Total Inventory Value", formatCurrency(inventory?.metrics.inventoryValue)],
    ["Average Vehicle Price", formatCurrency(inventory?.metrics.averageVehiclePrice)],
    ["Highest Price Vehicle", highestPriceVehicle ? `${highestPriceVehicle.title} (${formatCurrency(highestPriceVehicle.priceNumber ?? highestPriceVehicle.price)})` : "No inventory"],
    ["Newest Year Vehicle", newestYearVehicle ? `${newestYearVehicle.year ?? "n/a"} ${newestYearVehicle.title}` : "No inventory"],
  ] as const;
  const applicationSummaryMetrics = [
    ["Inventory Value", formatCurrency(inventory?.metrics.inventoryValue)],
    ["Average Vehicle Price", formatCurrency(inventory?.metrics.averageVehiclePrice)],
    ["Inventory Age", inventory?.metrics.averageModelAge === null || inventory?.metrics.averageModelAge === undefined ? "—" : `${inventory.metrics.averageModelAge} yrs`],
    ["Vehicles Added This Month", inventory?.metrics.vehiclesAddedThisMonth ?? "—"],
    ["Applications Submitted", dashboard.metrics.totalApplications],
    ["Finance Approval Rate", `${dashboard.metrics.approvalRatio}%`],
  ] as const;
  void applicationSummaryMetrics;

  const missingImageCount =
    inventory?.diagnostics?.brokenImageLinks ??
    inventory?.vehicles.filter((vehicle) => !vehicle.imageUrl).length ??
    0;

  return (
    <div className="relative isolate mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      {error ? (
        <Card className="relative z-10">
          <IdentityCardHeader title="Vehicle Finance Intelligence" subtitle="Executive dashboard unavailable" />
          <p className="mt-4 text-sm text-slate-300">{error}</p>
        </Card>
      ) : null}

      <section className="relative z-10 min-h-[560px] overflow-hidden rounded-[32px] border border-sky-300/25 bg-slate-950 shadow-[0_28px_100px_rgba(2,8,23,0.55)] lg:min-h-[650px]">
        <Image
          src={ROAR_SHOWROOM_SRC}
          alt="Roar Cars SA premium vehicle showroom"
          fill
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,6,23,0.96)_0%,rgba(2,8,23,0.82)_48%,rgba(2,8,23,0.28)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_22%,rgba(56,189,248,0.14),transparent_26%),linear-gradient(to_top,rgba(2,6,23,0.82),transparent_48%)]" />

        <div className="relative flex min-h-[560px] flex-col justify-between gap-12 px-6 py-9 sm:px-8 lg:min-h-[650px] lg:max-w-[68%] lg:px-12 lg:py-12">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-sky-200/25 bg-slate-950/55 px-4 py-2 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-100">Roar Cars SA Vehicle Division</span>
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.38em] text-sky-200/80">Born To Roar</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl lg:text-7xl">
              The dealership command center.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200/90 lg:text-lg">
              One premium workspace for vehicle stock, customer enquiries, finance applications, verification, underwriting, and executive performance.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/dashboard/vehicle-finance/inventory" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:border-sky-200/30 hover:bg-sky-300/15`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-100/75">Vehicle Listings</p>
              <p className="mt-4 text-lg font-semibold text-white">{inventory ? `${inventory.metrics.activeVehicles} Active Vehicles` : "Inventory sync unavailable"}</p>
              <p className="mt-2 text-xs leading-5 text-slate-200">{inventoryError ?? inventory?.warning ?? "Synced from Roar Cars website"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Last synced {formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt)}</p>
            </Link>
            <Link href="/dashboard/vehicle-finance/customers" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:border-sky-200/30 hover:bg-sky-300/15`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-100/75">Customer Enquiries</p>
              <p className="mt-4 text-3xl font-semibold text-white">{dashboard.customers.length}</p>
            </Link>
            <Link href="/dashboard/vehicle-finance/applications" className={`${EXECUTIVE_METRIC_CARD_CLASS} block text-left no-underline transition hover:border-sky-200/30 hover:bg-sky-300/15`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-100/75">Finance Applications</p>
              <p className="mt-4 text-3xl font-semibold text-white">{loading ? "—" : totalApplications}</p>
            </Link>
          </div>
        </div>
      </section>

      <section id="executive-overview" className="scroll-mt-40 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventoryMetrics.map(([label, value]) => (
          <Card key={label} className={`${EXECUTIVE_METRIC_CARD_CLASS} flex flex-col justify-between`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
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
          <IdentityCardHeader title="Featured Vehicles" subtitle="Live Roar inventory highlights">
            <div className="flex flex-wrap gap-2">
              <Badge tone={inventory?.status === "LIVE" ? "success" : inventory?.status === "CACHED" ? "warning" : "danger"}>
                {inventory?.status ?? "UNAVAILABLE"}
              </Badge>
              <Badge tone={missingImageCount > 0 ? "warning" : "success"}>{missingImageCount} missing images</Badge>
            </div>
          </IdentityCardHeader>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {inventoryVehicles.length
              ? inventoryVehicles.slice(0, 2).map((vehicle) => (
                  <article key={vehicle.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_20px_50px_rgba(2,8,23,0.22)]">
                    <div className="relative aspect-[16/9] bg-slate-950/70 p-3 md:p-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vehicle.imageUrl ?? "/images/roar-cars-placeholder.svg"}
                        alt={vehicle.title}
                        loading="lazy"
                        onError={(event) => {
                          if (!event.currentTarget.src.endsWith("/images/roar-cars-placeholder.svg")) {
                            event.currentTarget.src = "/images/roar-cars-placeholder.svg";
                          }
                        }}
                        className="h-full w-full object-contain object-center p-2 md:p-3 lg:p-4"
                      />
                    </div>
                    <div className="border-t border-white/10 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
                        {vehicle.make} {vehicle.model}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{vehicle.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {formatCurrency(vehicle.priceNumber ?? vehicle.price)} · {vehicle.year ?? "n/a"}
                      </p>
                    </div>
                  </article>
                ))
              : (
                  <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/[0.08] p-5 text-amber-50 md:col-span-2">
                    <p className="font-semibold">Inventory sync unavailable</p>
                    <p className="mt-2 text-sm leading-6 text-slate-100">
                      {inventoryError || inventory?.warning || "No live Roar Cars vehicles are available from the synchronized feed yet."}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-100/80">
                      Last sync {formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt)}
                    </p>
                  </div>
                )}
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

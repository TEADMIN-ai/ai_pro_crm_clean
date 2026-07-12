"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";
import {
  formatOpportunityStatus,
  opportunityRegisterDepartments,
  opportunityRegisterMunicipalities,
  opportunityRegisterRecords,
  opportunityRegisterStatuses,
  opportunityStatusTone,
  progressTone,
  readinessTone,
  type OpportunityRegisterRecord,
  type OpportunityRegisterStatus,
} from "@/components/opportunity-register/opportunityRegisterData";

type Filters = {
  search: string;
  municipality: string;
  department: string;
  closingDate: string;
  status: string;
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) {
    return `R ${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `R ${(value / 1_000).toFixed(0)}k`;
  }

  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function matchesSearch(opportunity: OpportunityRegisterRecord, search: string) {
  if (!search) return true;

  const haystack = [
    opportunity.rfqNumber,
    opportunity.client,
    opportunity.municipality,
    opportunity.department,
    opportunity.coordinator,
    opportunity.summary,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function OpportunityRegisterCard({ opportunity }: { opportunity: OpportunityRegisterRecord }) {
  return (
    <Link href={`/dashboard/opportunity-register/${opportunity.id}`} className="block no-underline">
      <EnterpriseCard
        interactive
        className="h-full p-5 transition-transform duration-200 hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tex-eyebrow">{opportunity.rfqNumber}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">
              {opportunity.client}
            </h3>
          </div>
          <EnterpriseStatusBadge
            value={formatOpportunityStatus(opportunity.status)}
            tone={opportunityStatusTone(opportunity.status)}
          />
        </div>

        <p className="tex-copy mt-3 text-sm">{opportunity.summary}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetaField label="Municipality" value={opportunity.municipality} />
          <MetaField label="Department" value={opportunity.department} />
          <MetaField label="Closing Date" value={formatDate(opportunity.closingDate)} />
          <MetaField label="Assigned Contractors" value={String(opportunity.assignedContractors)} />
          <MetaField
            label="Submission Readiness"
            value={`${opportunity.submissionReadiness}%`}
            tone={readinessTone(opportunity.submissionReadiness)}
          />
          <MetaField label="Estimated Value" value={formatCurrency(opportunity.estimatedValue)} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">
              Submission Progress
            </p>
            <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{opportunity.submissionProgress}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--tex-surface-muted)]">
            <div
              className="h-full rounded-full bg-[color:var(--tex-primary)]"
              style={{ width: `${opportunity.submissionProgress}%` }}
            />
          </div>
        </div>
      </EnterpriseCard>
    </Link>
  );
}

function normalizeBadgeTone(tone: EnterpriseTone): "neutral" | "success" | "warning" | "danger" | "info" | "completed" {
  switch (tone) {
    case "success":
    case "warning":
    case "danger":
    case "info":
    case "neutral":
    case "completed":
      return tone;
    default:
      return "info";
  }
}

function MetaField({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: EnterpriseTone;
}) {
  const badgeTone = normalizeBadgeTone(tone);

  return (
    <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{value}</p>
        {tone !== "neutral" ? <EnterpriseStatusBadge value={tone === "completed" ? "Complete" : "Ready"} tone={badgeTone} /> : null}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[color:var(--tex-text-strong)]">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export default function OpportunityRegisterWorkspace() {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    municipality: "",
    department: "",
    closingDate: "",
    status: "",
  });

  const filteredOpportunities = useMemo(() => {
    return opportunityRegisterRecords
      .filter((opportunity) => matchesSearch(opportunity, filters.search))
      .filter((opportunity) => (filters.municipality ? opportunity.municipality === filters.municipality : true))
      .filter((opportunity) => (filters.department ? opportunity.department === filters.department : true))
      .filter((opportunity) => (filters.status ? opportunity.status === filters.status : true))
      .filter((opportunity) => (filters.closingDate ? opportunity.closingDate <= filters.closingDate : true))
      .sort((left, right) => left.closingDate.localeCompare(right.closingDate));
  }, [filters]);

  const summary = useMemo(() => {
    const pipelineValue = opportunityRegisterRecords.reduce((total, opportunity) => total + opportunity.estimatedValue, 0);
    const closingSoon = opportunityRegisterRecords.filter((opportunity) => opportunity.closingDate <= "2026-07-19").length;
    const activeCount = opportunityRegisterRecords.filter((opportunity) => opportunity.status !== "awarded").length;
    const awardProbability = Math.round(
      opportunityRegisterRecords.reduce((total, opportunity) => total + opportunity.submissionReadiness, 0) /
        opportunityRegisterRecords.length
    );
    const estimatedRevenue = opportunityRegisterRecords
      .filter((opportunity) => opportunity.status === "submitted" || opportunity.status === "ready")
      .reduce((total, opportunity) => total + opportunity.estimatedValue * (opportunity.submissionReadiness / 100), 0);
    const highRiskCount = opportunityRegisterRecords.filter((opportunity) => opportunity.status === "atRisk").length;
    return {
      pipelineValue,
      closingSoon,
      activeCount,
      awardProbability,
      estimatedRevenue,
      highRiskCount,
    };
  }, []);

  const hasFilters =
    Boolean(filters.search) || Boolean(filters.municipality) || Boolean(filters.department) || Boolean(filters.closingDate) || Boolean(filters.status);

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Primary TEOS workspace</p>
              <h1 className="tex-title mt-3">Opportunity Register</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Every RFQ, RFP, tender, quotation request, and private opportunity begins here. This register keeps the operational
                view presentation-only while preserving a single workspace for search, filtering, and opportunity handoff.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Presentation only" tone="neutral" />
              <EnterpriseStatusBadge value="No AI or OCR" tone="warning" />
              <EnterpriseStatusBadge value="No API mutations" tone="success" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard
            label="Pipeline Value"
            value={formatCurrency(summary.pipelineValue)}
            helper="Weighted opportunity value across the register."
            trend="Portfolio view"
          />
          <EnterpriseKpiCard
            label="Opportunities Closing This Week"
            value={summary.closingSoon}
            helper="Records closing within the current review window."
            trend="Submission clock"
          />
          <EnterpriseKpiCard
            label="Active Opportunities"
            value={summary.activeCount}
            helper="Live records excluding awarded items."
            trend="Operational queue"
          />
          <EnterpriseKpiCard
            label="Award Probability"
            value={`${summary.awardProbability}%`}
            helper="Portfolio-average readiness score."
            trend="Readiness weighted"
          />
          <EnterpriseKpiCard
            label="Estimated Revenue"
            value={formatCurrency(summary.estimatedRevenue)}
            helper="Expected revenue from ready and submitted opportunities."
            trend="Projected award value"
          />
          <EnterpriseKpiCard
            label="High Risk Opportunities"
            value={summary.highRiskCount}
            helper="Opportunities requiring immediate executive attention."
            trend="Escalation queue"
          />
          <EnterpriseKpiCard
            label="Assigned Contractors"
            value={opportunityRegisterRecords.reduce((total, opportunity) => total + opportunity.assignedContractors, 0)}
            helper="Total contractor assignments across the register."
            trend="Bid coverage"
          />
          <EnterpriseKpiCard
            label="Average Submission Progress"
            value={`${Math.round(
              opportunityRegisterRecords.reduce((total, opportunity) => total + opportunity.submissionProgress, 0) /
                opportunityRegisterRecords.length
            )}%`}
            helper="Presentation progress across all open records."
            trend="Execution flow"
          />
        </div>
      </EnterpriseCard>

      <EnterpriseCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="tex-eyebrow">Register controls</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">
              Search, filter, and open opportunity workspaces
            </h2>
            <p className="tex-copy mt-3 text-sm">
              Use the register to narrow the active queue by municipality, department, closing date, or status. Each card opens the
              corresponding workspace view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnterpriseActionButton href="/dashboard/opportunity-register/new">New Opportunity</EnterpriseActionButton>
            <EnterpriseActionButton href="/dashboard/opportunity-register/upload" variant="secondary">
              Upload Opportunity
            </EnterpriseActionButton>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <FilterField label="Search">
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search RFQ, client, municipality, department, or coordinator"
            />
          </FilterField>
          <FilterField label="Municipality">
            <select
              value={filters.municipality}
              onChange={(event) => setFilters((current) => ({ ...current, municipality: event.target.value }))}
            >
              <option value="">All municipalities</option>
              {opportunityRegisterMunicipalities.map((municipality) => (
                <option key={municipality} value={municipality}>
                  {municipality}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Department">
            <select
              value={filters.department}
              onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
            >
              <option value="">All departments</option>
              {opportunityRegisterDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Closing Date">
            <input
              type="date"
              value={filters.closingDate}
              onChange={(event) => setFilters((current) => ({ ...current, closingDate: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Status">
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {opportunityRegisterStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatOpportunityStatus(status)}
                </option>
              ))}
            </select>
          </FilterField>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--tex-text-muted)]">
            {filteredOpportunities.length} opportunity{filteredOpportunities.length === 1 ? "" : "ies"} visible
            {hasFilters ? " after filtering." : "."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() =>
                setFilters({
                  search: "",
                  municipality: "",
                  department: "",
                  closingDate: "",
                  status: "",
                })
              }
              className="tex-action-button tex-action-button--secondary px-3 py-2 text-xs"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </EnterpriseCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredOpportunities.length ? (
          filteredOpportunities.map((opportunity) => (
            <OpportunityRegisterCard key={opportunity.id} opportunity={opportunity} />
          ))
        ) : (
          <EnterpriseEmptyState
            title="No opportunities match the current filters."
            detail="Adjust the register filters to surface additional opportunities."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
      </section>
    </main>
  );
}




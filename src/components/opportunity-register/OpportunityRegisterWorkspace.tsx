"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterpriseStatusBadge,
} from "@/components/ui/EnterpriseUI";
import {
  formatOpportunityStatus,
  opportunityRegisterDepartments,
  opportunityRegisterMunicipalities,
  opportunityRegisterRecords,
  opportunityRegisterStatuses,
} from "@/components/opportunity-register/opportunityRegisterData";

type Filters = {
  search: string;
  municipality: string;
  department: string;
  closingDate: string;
  status: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[color:var(--tex-text-strong)]">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export default function OpportunityRegisterWorkspace() {
  const [filters, setFilters] = useState<Filters>({ search: "", municipality: "", department: "", closingDate: "", status: "" });

  const filteredOpportunities = useMemo(() => opportunityRegisterRecords.filter((opportunity) => {
    const search = filters.search.trim().toLowerCase();
    const haystack = [opportunity.rfqNumber, opportunity.client, opportunity.municipality, opportunity.department, opportunity.coordinator, opportunity.summary].join(" ").toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (!filters.municipality || opportunity.municipality === filters.municipality) &&
      (!filters.department || opportunity.department === filters.department) &&
      (!filters.status || opportunity.status === filters.status) &&
      (!filters.closingDate || opportunity.closingDate <= filters.closingDate)
    );
  }), [filters]);

  const hasFilters = Boolean(filters.search) || Boolean(filters.municipality) || Boolean(filters.department) || Boolean(filters.closingDate) || Boolean(filters.status);

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Primary TEOS workspace</p>
              <h1 className="tex-title mt-3">Opportunity Register</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                No live opportunity records are connected in this checkout. The register will populate from production data when the Firestore source is connected.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Production data required" tone="neutral" />
              <EnterpriseStatusBadge value="No live records connected" tone="success" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Pipeline Value" value={formatCurrency(0)} helper="No live records connected." />
          <EnterpriseKpiCard label="Opportunities Closing This Week" value={0} helper="No live records connected." />
          <EnterpriseKpiCard label="Active Opportunities" value={0} helper="No live records connected." />
          <EnterpriseKpiCard label="Award Probability" value="0%" helper="No live records connected." />
          <EnterpriseKpiCard label="Estimated Revenue" value={formatCurrency(0)} helper="No live records connected." />
          <EnterpriseKpiCard label="High Risk Opportunities" value={0} helper="No live records connected." />
          <EnterpriseKpiCard label="Assigned Contractors" value={0} helper="No live records connected." />
          <EnterpriseKpiCard label="Average Submission Progress" value="0%" helper="No live records connected." />
        </div>
      </EnterpriseCard>

      <EnterpriseCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="tex-eyebrow">Register controls</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">
              Search, filter, and open opportunity workspaces
            </h2>
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
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search RFQ, client, municipality, department, or coordinator" />
          </FilterField>
          <FilterField label="Municipality">
            <select value={filters.municipality} onChange={(event) => setFilters((current) => ({ ...current, municipality: event.target.value }))}>
              <option value="">All municipalities</option>
              {opportunityRegisterMunicipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}
            </select>
          </FilterField>
          <FilterField label="Department">
            <select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="">All departments</option>
              {opportunityRegisterDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </FilterField>
          <FilterField label="Closing Date">
            <input type="date" value={filters.closingDate} onChange={(event) => setFilters((current) => ({ ...current, closingDate: event.target.value }))} />
          </FilterField>
          <FilterField label="Status">
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              {opportunityRegisterStatuses.map((status) => <option key={status} value={status}>{formatOpportunityStatus(status)}</option>)}
            </select>
          </FilterField>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--tex-text-muted)]">
            {filteredOpportunities.length} opportunity{filteredOpportunities.length === 1 ? "" : "ies"} visible{hasFilters ? " after filtering." : "."}
          </p>
          {hasFilters ? (
            <button type="button" onClick={() => setFilters({ search: "", municipality: "", department: "", closingDate: "", status: "" })} className="tex-action-button tex-action-button--secondary px-3 py-2 text-xs">
              Clear filters
            </button>
          ) : null}
        </div>
      </EnterpriseCard>

      <EnterpriseEmptyState
        title="No opportunities have been created."
        detail="Connect the production opportunity source to populate the register."
        className="md:col-span-2 xl:col-span-3"
      />
    </main>
  );
}

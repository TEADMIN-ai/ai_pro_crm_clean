"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterpriseStatusBadge,
} from "@/components/ui/EnterpriseUI";
import { useAuth } from "@/context/AuthContext";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import type { Deal } from "@/types/deal";
import {
  formatOpportunityStatus,
  mapDealToOpportunityRegisterRecord,
  opportunityRegisterDepartments,
  opportunityRegisterMunicipalities,
  opportunityRegisterStatuses,
  opportunityStatusTone,
  readinessTone,
  type OpportunityRegisterRecord,
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

function isOpportunityDeal(deal: Deal) {
  const source = deal as Deal & Record<string, unknown>;
  return (
    deal.type === "opportunity" ||
    source.source === "opportunity-register-upload" ||
    Boolean(source.opportunityIntake)
  );
}

function uniqueSorted(values: string[], fallback: string[]) {
  const unique = Array.from(new Set(values.filter((value) => value.trim().length > 0)));
  return unique.length > 0 ? unique.sort((a, b) => a.localeCompare(b)) : fallback;
}

export default function OpportunityRegisterWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<Filters>({ search: "", municipality: "", department: "", closingDate: "", status: "" });
  const [opportunities, setOpportunities] = useState<OpportunityRegisterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOpportunities() {
      if (authLoading) return;
      if (!user) {
        setOpportunities([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const deals = await getDealsForUser(user);
        if (cancelled) return;
        setOpportunities(deals.filter(isOpportunityDeal).map(mapDealToOpportunityRegisterRecord));
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load opportunity records");
        setOpportunities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOpportunities();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const municipalities = useMemo(
    () => uniqueSorted(opportunities.map((opportunity) => opportunity.municipality), opportunityRegisterMunicipalities),
    [opportunities],
  );
  const departments = useMemo(
    () => uniqueSorted(opportunities.map((opportunity) => opportunity.department), opportunityRegisterDepartments),
    [opportunities],
  );

  const filteredOpportunities = useMemo(() => opportunities.filter((opportunity) => {
    const search = filters.search.trim().toLowerCase();
    const haystack = [opportunity.rfqNumber, opportunity.client, opportunity.municipality, opportunity.department, opportunity.coordinator, opportunity.summary].join(" ").toLowerCase();
    return (
      (!search || haystack.includes(search)) &&
      (!filters.municipality || opportunity.municipality === filters.municipality) &&
      (!filters.department || opportunity.department === filters.department) &&
      (!filters.status || opportunity.status === filters.status) &&
      (!filters.closingDate || opportunity.closingDate <= filters.closingDate)
    );
  }), [filters, opportunities]);

  const hasFilters = Boolean(filters.search) || Boolean(filters.municipality) || Boolean(filters.department) || Boolean(filters.closingDate) || Boolean(filters.status);
  const pipelineValue = opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedValue, 0);
  const closingSoon = opportunities.filter((opportunity) => {
    const closing = new Date(opportunity.closingDate).getTime();
    const now = Date.now();
    return Number.isFinite(closing) && closing >= now && closing <= now + 7 * 24 * 60 * 60 * 1000;
  }).length;
  const averageReadiness = opportunities.length ? Math.round(opportunities.reduce((sum, opportunity) => sum + opportunity.submissionReadiness, 0) / opportunities.length) : 0;
  const assignedContractors = opportunities.reduce((sum, opportunity) => sum + opportunity.assignedContractors, 0);

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Primary TEOS workspace</p>
              <h1 className="tex-title mt-3">Opportunity Register</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Live opportunity records are loaded from the canonical deals workflow and upload intake records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={loading ? "Loading records" : "Production source connected"} tone={loading ? "warning" : "success"} />
              <EnterpriseStatusBadge value={error ? "Load error" : "Deals collection"} tone={error ? "danger" : "info"} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Pipeline Value" value={formatCurrency(pipelineValue)} helper="Sum of registered opportunity values." />
          <EnterpriseKpiCard label="Opportunities Closing This Week" value={closingSoon} helper="Based on closing dates in live records." />
          <EnterpriseKpiCard label="Active Opportunities" value={opportunities.length} helper="Opportunity intake and deal records." />
          <EnterpriseKpiCard label="Award Probability" value={opportunities.length ? "Tracked" : "0%"} helper="Available after opportunity enrichment." />
          <EnterpriseKpiCard label="Estimated Revenue" value={formatCurrency(pipelineValue)} helper="Current estimated opportunity value." />
          <EnterpriseKpiCard label="High Risk Opportunities" value={opportunities.filter((opportunity) => opportunity.status === "atRisk").length} helper="Readiness below threshold." />
          <EnterpriseKpiCard label="Assigned Contractors" value={assignedContractors} helper="Contractor assignments across visible records." />
          <EnterpriseKpiCard label="Average Submission Progress" value={String(averageReadiness) + "%"} helper="Average readiness score." />
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
              {municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}
            </select>
          </FilterField>
          <FilterField label="Department">
            <select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
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
        {error ? <p className="mt-4 text-sm font-semibold text-[color:var(--tex-danger)]">{error}</p> : null}
      </EnterpriseCard>

      {loading ? (
        <EnterpriseEmptyState title="Loading opportunities." detail="Fetching opportunity records from the canonical deals workflow." />
      ) : filteredOpportunities.length === 0 ? (
        <EnterpriseEmptyState
          title="No opportunities found."
          detail={hasFilters ? "Adjust the filters to show more opportunity records." : "Use the upload workflow to create the first production opportunity record."}
          className="md:col-span-2 xl:col-span-3"
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredOpportunities.map((opportunity) => (
            <EnterpriseCard key={opportunity.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="tex-eyebrow">{opportunity.rfqNumber}</p>
                  <h3 className="mt-2 text-xl font-semibold text-[color:var(--tex-text-strong)]">{opportunity.summary}</h3>
                  <p className="tex-copy mt-2 text-sm">{opportunity.client} | {opportunity.municipality} | {opportunity.department}</p>
                </div>
                <EnterpriseStatusBadge value={formatOpportunityStatus(opportunity.status)} tone={opportunityStatusTone(opportunity.status)} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <EnterpriseKpiCard label="Closing Date" value={opportunity.closingDate} helper="Source notice deadline" />
                <EnterpriseKpiCard label="Estimated Value" value={formatCurrency(opportunity.estimatedValue)} helper="Optional RFQ value" />
                <EnterpriseKpiCard label="Readiness" value={String(opportunity.submissionReadiness) + "%"} helper={<EnterpriseStatusBadge value="Readiness" tone={readinessTone(opportunity.submissionReadiness)} />} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <EnterpriseActionButton href={"/dashboard/opportunity-register/" + encodeURIComponent(opportunity.id)}>
                  Open Opportunity
                </EnterpriseActionButton>
              </div>
            </EnterpriseCard>
          ))}
        </section>
      )}
    </main>
  );
}

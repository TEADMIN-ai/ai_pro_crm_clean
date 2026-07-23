"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterpriseLoadingState,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import {
  formatAssignedOpportunities,
  formatContractorDate,
  formatDocumentCoverage,
  formatReviewCount,
  getContractorBusinessName,
  getContractorCanonicalId,
  getContractorTradingName,
  getContractorWorkspaceLabel,
  summarizeContractorList,
  type ContractorListItem,
} from "@/lib/contractors/contractorListModel";
import {
  getBusinessFacingContractorReference,
  getCipcRegistrationNumber,
  getCsdSupplierNumber,
} from "@/lib/contractors/contractorReferencePresentation";

type LoadState = "loading" | "ready" | "empty" | "forbidden" | "error";

function normalizeContractorPayload(payload: unknown): ContractorListItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is ContractorListItem => Boolean(item && typeof item === "object" && "id" in item),
    );
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { contractors?: unknown }).contractors)) {
    return (payload as { contractors: ContractorListItem[] }).contractors;
  }

  return [];
}

function readinessLabel(contractor: ContractorListItem): string {
  if (typeof contractor.readinessScore === "number") {
    return `${contractor.readinessScore}%`;
  }

  return "Pending";
}

function statusLabel(contractor: ContractorListItem): string {
  if (contractor.archived === true) {
    return "Archived";
  }
  if (contractor.complianceApproved === true) {
    return "Approved";
  }

  return contractor.overallStatus?.trim() || contractor.status?.trim() || "Onboarding";
}

function latestUpdate(contractor: ContractorListItem): string {
  return formatContractorDate(contractor.lastDocumentUpdateAt ?? contractor.updatedAt ?? contractor.createdAt);
}

export default function ContractorsWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadContractors() {
    setState("loading");
    setErrorMessage(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        setContractors([]);
        setState("forbidden");
        setErrorMessage(
          payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Access denied",
        );
        return;
      }

      if (!response.ok) {
        setContractors([]);
        setState("error");
        setErrorMessage(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : `Repository request failed (${response.status})`,
        );
        return;
      }

      const nextContractors = normalizeContractorPayload(payload);
      setContractors(nextContractors);
      setState(nextContractors.length > 0 ? "ready" : "empty");
    } catch (error) {
      setContractors([]);
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load contractor repository.");
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadContractors();
    }, 0);

    return () => window.clearTimeout(handle);
  }, []);

  const summary = useMemo(() => summarizeContractorList(contractors), [contractors]);

  if (state === "loading") {
    return (
      <main data-module="dashboard" className="tex-shell grid gap-6">
        <EnterpriseLoadingState label="Loading live contractor repository..." />
      </main>
    );
  }

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Contractors</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">Contractor Workbench</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Live contractor records from the canonical contractor repository.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseActionButton onClick={() => void loadContractors()}>Refresh</EnterpriseActionButton>
              <EnterpriseActionButton href="/dashboard/contractors/new">New Contractor</EnterpriseActionButton>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Live Records" value={summary.total} helper="Canonical contractors collection." />
          <EnterpriseKpiCard label="Approved" value={summary.approved} helper="Compliance approved records." />
          <EnterpriseKpiCard
            label="Pending / Review"
            value={summary.pendingReview}
            helper="Records requiring review or completion."
          />
          <EnterpriseKpiCard
            label="Legacy Workspace"
            value={summary.legacyWithoutWorkspace}
            helper="Records without workspace IDs."
          />
        </div>
      </EnterpriseCard>

      {state === "forbidden" ? (
        <EnterpriseEmptyState
          title="Access denied."
          detail={errorMessage ?? "You are not authorised to view the contractor repository."}
        />
      ) : null}

      {state === "error" ? (
        <EnterpriseEmptyState
          title="Contractor repository could not be loaded."
          detail={errorMessage ?? "The repository returned an error. This is not a zero-record state."}
        />
      ) : null}

      {state === "empty" ? (
        <EnterpriseEmptyState
          title="No live contractors found."
          detail="The canonical contractor repository returned zero records for the current authorised context."
        />
      ) : null}

      {state === "ready" && summary.legacyWithoutWorkspace > 0 ? (
        <EnterpriseCard className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Legacy contractor records detected</p>
          <p className="mt-2">
            {summary.legacyWithoutWorkspace} contractor record(s) do not have a workspace ID. They are shown to
            authorised staff because they exist in the canonical Torque Empire contractor repository, but should be
            reviewed before workspace migration.
          </p>
        </EnterpriseCard>
      ) : null}

      {state === "ready" && summary.duplicateBusinessNames.length > 0 ? (
        <EnterpriseCard className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Duplicate business names detected</p>
          <p className="mt-2">
            {summary.duplicateBusinessNames.length} duplicate business name group(s) require administrator review before
            any merge or migration.
          </p>
        </EnterpriseCard>
      ) : null}

      {state === "ready" ? (
        <EnterpriseCard className="overflow-hidden p-0">
          <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
            <p className="tex-eyebrow">Repository</p>
            <h2 className="mt-2 text-xl font-bold text-[color:var(--tex-text-strong)]">Live Contractors</h2>
          </div>
          <EnterpriseTable>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contractor Reference</th>
                <th>Trading Name</th>
                <th>CIPC Registration Number</th>
                <th>CSD Supplier Number</th>
                <th>Onboarding Status</th>
                <th>Approval</th>
                <th>Readiness</th>
                <th>Assigned Opportunities</th>
                <th>Documents</th>
                <th>Review</th>
                <th>Workspace</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((contractor) => {
                const contractorId = getContractorCanonicalId(contractor);
                const contractorHref = `/dashboard/contractors/${encodeURIComponent(contractorId)}`;
                const legacy = !contractor.workspaceId?.trim();

                return (
                  <tr key={contractor.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => router.push(contractorHref)}
                        className="text-left font-semibold text-sky-700 hover:text-sky-900"
                      >
                        {getContractorBusinessName(contractor)}
                      </button>
                    </td>
                    <td>{getBusinessFacingContractorReference(contractor)}</td>
                    <td>{getContractorTradingName(contractor)}</td>
                    <td>{getCipcRegistrationNumber(contractor)}</td>
                    <td>{getCsdSupplierNumber(contractor)}</td>
                    <td>
                      <EnterpriseStatusBadge value={statusLabel(contractor)} />
                    </td>
                    <td>{contractor.complianceApproved === true ? "Approved" : "Not approved"}</td>
                    <td>{readinessLabel(contractor)}</td>
                    <td>{formatAssignedOpportunities(contractor)}</td>
                    <td>{formatDocumentCoverage(contractor)}</td>
                    <td>{formatReviewCount(contractor)}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span>{getContractorWorkspaceLabel(contractor)}</span>
                        {legacy ? <span className="text-xs font-semibold text-amber-700">Legacy record</span> : null}
                      </div>
                    </td>
                    <td>{latestUpdate(contractor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </EnterpriseTable>
        </EnterpriseCard>
      ) : null}
    </main>
  );
}

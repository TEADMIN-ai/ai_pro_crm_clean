"use client";

import { EnterpriseActionButton, EnterpriseCard, EnterpriseEmptyState, EnterpriseKpiCard } from "@/components/ui/EnterpriseUI";

export default function ContractorsWorkspace() {
  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Contractors</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">Contractor Workbench</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                No live contractor source is connected in this checkout. The workbench will populate from production data when the repository service is available.
              </p>
            </div>
            <EnterpriseActionButton href="/dashboard/contractors/new">New Contractor</EnterpriseActionButton>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Recommended" value={0} helper="No live contractor records connected." />
          <EnterpriseKpiCard label="Assigned" value={0} helper="No live contractor records connected." />
          <EnterpriseKpiCard label="Pending Review" value={0} helper="No live contractor records connected." />
          <EnterpriseKpiCard label="Rejected" value={0} helper="No live contractor records connected." />
        </div>
      </EnterpriseCard>

      <EnterpriseEmptyState
        title="No contractors have been onboarded."
        detail="Connect the contractor repository to render the operational workbench."
      />
    </main>
  );
}

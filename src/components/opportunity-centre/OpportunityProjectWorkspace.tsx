"use client";

import { EnterpriseCard, EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";

export default function OpportunityProjectWorkspace() {
  return (
    <main className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Primary TEOS Workspace</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">Opportunity Centre</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Live opportunity workspace content is not connected in this checkout.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Production data required" tone="neutral" />
              <EnterpriseStatusBadge value="No live records connected" tone="success" />
            </div>
          </div>
        </div>
      </EnterpriseCard>

      <EnterprisePanel title="Workspace status" eyebrow="Operational data">
        <EnterpriseEmptyState
          title="No live opportunity workspace is connected."
          detail="Connect the opportunity record source before rendering contractor, document, timeline, or submission data."
        />
      </EnterprisePanel>
    </main>
  );
}

"use client";

import { useState } from "react";
import { EnterpriseCard, EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import { createEmptyTenderPackBuilderState } from "@/lib/tender/tenderPackBuilder";

export default function TenderPackBuilderWorkspace() {
  const [state] = useState(createEmptyTenderPackBuilderState());

  return (
    <main className="space-y-6 p-4 md:p-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Tender Pack workspace</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">{state.title}</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                No live tender-pack record is connected. Production data will populate this workspace when the source is available.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Production data required" tone="neutral" />
            </div>
          </div>
        </div>
      </EnterpriseCard>

      <EnterprisePanel title="Tender pack state" eyebrow="Operational data">
        <EnterpriseEmptyState
          title="No tender pack data is connected."
          detail="Connect a live deal or opportunity source before showing documents, PDFs, or submission progress."
        />
      </EnterprisePanel>
    </main>
  );
}

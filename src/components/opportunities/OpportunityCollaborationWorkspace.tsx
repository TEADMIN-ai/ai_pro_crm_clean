"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import { EnterpriseEmptyState } from "@/components/ui/EnterpriseUI";
import {
  buildOpportunityCollaborationWorkspace,
  type BuildOpportunityCollaborationWorkspaceInput,
  type OpportunityCollaborationSectionKey,
} from "@/lib/opportunities/collaborationWorkspace";

type Props = BuildOpportunityCollaborationWorkspaceInput;

export default function OpportunityCollaborationWorkspace(props: Props) {
  const workspace = useMemo(() => buildOpportunityCollaborationWorkspace(props), [props]);
  const [activeKey, setActiveKey] = useState<OpportunityCollaborationSectionKey>("overview");
  const activeSection = workspace.sections.find((section) => section.key === activeKey) ?? workspace.sections[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Opportunity Collaboration Workspace</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{workspace.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{workspace.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Live source required</Badge>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        {activeSection?.items.length ? (
          <div />
        ) : (
          <EnterpriseEmptyState
            title="No collaboration records are connected."
            detail="This workspace will populate from production opportunity data when the source is available."
          />
        )}
      </div>
    </section>
  );
}

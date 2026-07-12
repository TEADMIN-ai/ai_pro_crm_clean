"use client";

import { useMemo, useState } from "react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import {
  buildMockOpportunityCollaborationWorkspace,
  type BuildOpportunityCollaborationWorkspaceInput,
  type OpportunityCollaborationItem,
  type OpportunityCollaborationSection,
  type OpportunityCollaborationSectionKey,
  type OpportunityCollaborationStatus,
} from "@/lib/opportunities/collaborationWorkspace";

type Props = BuildOpportunityCollaborationWorkspaceInput;

const SECTION_ORDER: OpportunityCollaborationSectionKey[] = [
  "overview",
  "teamChat",
  "documents",
  "sbdForms",
  "boq",
  "tasks",
  "timeline",
  "approvals",
  "submission",
  "auditTrail",
  "activityFeed",
];

function statusTone(status: OpportunityCollaborationStatus): BadgeTone {
  if (status === "complete") return "success";
  if (status === "blocked") return "danger";
  if (status === "in_progress") return "info";
  return "warning";
}

function statusLabel(status: OpportunityCollaborationStatus): string {
  return status.replace(/_/g, " ");
}

function sectionMetric(section: OpportunityCollaborationSection): string {
  const completed = section.items.filter((item) => item.status === "complete").length;
  return `${completed}/${section.items.length}`;
}

function SectionItems({ items }: { items: OpportunityCollaborationItem[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{item.label}</p>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
            </div>
            <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
          </div>
          {item.owner || item.timestamp ? (
            <p className="mt-3 text-xs font-medium text-slate-500">
              {item.owner ? `Owner: ${item.owner}` : "Presentation item"}
              {item.timestamp ? ` - ${new Date(item.timestamp).toLocaleString("en-ZA")}` : ""}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function OpportunityCollaborationWorkspace(props: Props) {
  const workspace = useMemo(() => buildMockOpportunityCollaborationWorkspace(props), [props]);
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
          <Badge tone="neutral">Presentation only</Badge>
          <Badge tone="info">Mock data</Badge>
          <Badge tone="warning">No chat backend</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        {SECTION_ORDER.map((sectionKey) => {
          const section = workspace.sections.find((candidate) => candidate.key === sectionKey);
          if (!section) return null;
          const isActive = activeKey === section.key;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveKey(section.key)}
              className={`min-h-16 rounded-lg border px-3 py-2 text-left transition ${
                isActive
                  ? "border-sky-300 bg-sky-50 text-sky-950"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span className="block text-sm font-semibold">{section.title}</span>
              <span className="mt-1 block text-xs">{sectionMetric(section)} complete</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">{activeSection.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{activeSection.summary}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {activeSection.items.length} items
          </span>
        </div>
        <SectionItems items={activeSection.items} />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import OpportunityWorkspaceSection from "@/components/contractor-opportunities/OpportunityWorkspaceSection";
import { CONTRACTOR_OPPORTUNITY_SECTIONS } from "@/lib/contractor-opportunities/workspaceSections";
import type {
  ContractorOpportunityChecklistItem,
  ContractorOpportunityNote,
  ContractorOpportunityPriority,
  ContractorOpportunityRecommendation,
  ContractorOpportunitySectionKey,
  ContractorOpportunityTimelineItem,
  ContractorOpportunityWorkspace as ContractorOpportunityWorkspaceModel,
} from "@/lib/contractor-opportunities/types";

type Props = {
  opportunities: ContractorOpportunityWorkspaceModel[];
};

function formatDate(value?: string | number | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readinessLabel(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value}% readiness` : "Readiness pending";
}

function priorityTone(priority: ContractorOpportunityPriority): BadgeTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

function checklistTone(status: ContractorOpportunityChecklistItem["status"]): BadgeTone {
  if (status === "complete") return "success";
  if (status === "blocked") return "danger";
  if (status === "inReview") return "review";
  return "notStarted";
}

function SectionShell({
  sectionKey,
  count,
  children,
}: {
  sectionKey: ContractorOpportunitySectionKey;
  count: number;
  children?: ReactNode;
}) {
  const definition = CONTRACTOR_OPPORTUNITY_SECTIONS.find((section) => section.key === sectionKey);
  if (!definition) return null;

  return (
    <OpportunityWorkspaceSection title={definition.title} count={count} emptyLabel={definition.emptyLabel}>
      {count > 0 ? children : null}
    </OpportunityWorkspaceSection>
  );
}

function TimelineList({ items }: { items: ContractorOpportunityTimelineItem[] }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
          {item.description ? <p className="mt-1 text-xs text-slate-600">{item.description}</p> : null}
          <p className="mt-2 text-[11px] font-medium text-slate-500">{formatDate(item.timestamp)}</p>
        </div>
      ))}
    </div>
  );
}

function NoteList({ notes }: { notes: ContractorOpportunityNote[] }) {
  return (
    <div className="space-y-2">
      {notes.slice(0, 4).map((note) => (
        <div key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          {note.title ? <p className="text-sm font-semibold text-slate-900">{note.title}</p> : null}
          <p className="text-sm text-slate-700">{note.body}</p>
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            {note.authorName ?? note.audience} - {formatDate(note.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function RecommendationList({ recommendations }: { recommendations: ContractorOpportunityRecommendation[] }) {
  return (
    <div className="space-y-2">
      {recommendations.slice(0, 5).map((recommendation) => (
        <div key={recommendation.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{recommendation.title}</p>
            <Badge tone={priorityTone(recommendation.priority)}>{recommendation.priority}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700">{recommendation.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ChecklistList({ items }: { items: ContractorOpportunityChecklistItem[] }) {
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
            {item.detail ? <p className="mt-1 text-xs text-slate-600">{item.detail}</p> : null}
          </div>
          <Badge tone={checklistTone(item.status)}>{item.status}</Badge>
        </div>
      ))}
    </div>
  );
}

export default function ContractorOpportunityWorkspace({ opportunities }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Contractor Opportunity Workspace</h2>
          <p className="mt-1 text-sm text-slate-600">Reusable opportunity architecture for communications, files, recommendations, history, and submission readiness.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {opportunities.length} opportunities
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {opportunities.length ? (
          opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  {opportunity.href ? (
                    <Link href={opportunity.href} className="text-base font-semibold text-slate-950 hover:text-sky-700">
                      {opportunity.title}
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-slate-950">{opportunity.title}</h3>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {opportunity.stage ?? "Opportunity"} - {opportunity.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info">{readinessLabel(opportunity.readinessScore)}</Badge>
                  {opportunity.riskLevel ? <Badge tone="warning">{opportunity.riskLevel}</Badge> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <SectionShell sectionKey="messages" count={opportunity.messages.length} />
                <SectionShell sectionKey="timeline" count={opportunity.timeline.length}>
                  <TimelineList items={opportunity.timeline} />
                </SectionShell>
                <SectionShell sectionKey="aiRecommendations" count={opportunity.aiRecommendations.length}>
                  <RecommendationList recommendations={opportunity.aiRecommendations} />
                </SectionShell>
                <SectionShell sectionKey="staffNotes" count={opportunity.staffNotes.length}>
                  <NoteList notes={opportunity.staffNotes} />
                </SectionShell>
                <SectionShell sectionKey="contractorNotes" count={opportunity.contractorNotes.length}>
                  <NoteList notes={opportunity.contractorNotes} />
                </SectionShell>
                <SectionShell sectionKey="fileUploads" count={opportunity.fileUploads.length}>
                  <div className="space-y-2">
                    {opportunity.fileUploads.slice(0, 6).map((file) => (
                      <div key={file.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {file.status ?? "Uploaded"} - {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionShell>
                <SectionShell sectionKey="activityHistory" count={opportunity.activityHistory.length}>
                  <div className="space-y-2">
                    {opportunity.activityHistory.slice(0, 6).map((activity) => (
                      <div key={activity.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">{activity.label}</p>
                        <p className="mt-1 text-xs text-slate-600">{formatDate(activity.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                </SectionShell>
                <SectionShell sectionKey="submissionChecklist" count={opportunity.submissionChecklist.length}>
                  <ChecklistList items={opportunity.submissionChecklist} />
                </SectionShell>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            No linked opportunities assigned to this contractor.
          </p>
        )}
      </div>
    </div>
  );
}

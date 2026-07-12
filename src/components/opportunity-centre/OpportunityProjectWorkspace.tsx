"use client";

import { useEffect, useMemo, useState } from "react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import ContractorMatchingPanel from "@/components/opportunities/ContractorMatchingPanel";
import OpportunityIntelligencePipeline from "@/components/opportunities/OpportunityIntelligencePipeline";
import {
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
  EnterpriseTabs,
} from "@/components/ui/EnterpriseUI";
import {
  buildMockOpportunityProjects,
  type OpportunityProjectContractor,
  type OpportunityProjectTabKey,
  type OpportunityProjectWorkspace,
} from "@/lib/opportunities/projectWorkspace";
import type { ContractorMatchRecommendation } from "@/lib/opportunities/contractorMatchingPresentation";
import { mockOpportunityIntelligencePipeline } from "@/lib/opportunities/intelligencePipelinePresentation";

const TAB_ITEMS: Array<{ key: OpportunityProjectTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "contractors", label: "Contractors" },
  { key: "documents", label: "Documents" },
  { key: "forms", label: "Forms" },
  { key: "boq", label: "BOQ" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Messages" },
  { key: "timeline", label: "Timeline" },
  { key: "submission", label: "Submission" },
  { key: "audit", label: "Audit" },
];

function toneFromRisk(risk: string): BadgeTone {
  if (risk === "LOW") return "success";
  if (risk === "MEDIUM") return "warning";
  return "danger";
}

function toneFromProjectStatus(status: OpportunityProjectWorkspace["status"]): BadgeTone {
  if (status === "ready") return "success";
  if (status === "submitted") return "info";
  if (status === "won") return "completed";
  if (status === "blocked") return "danger";
  return "warning";
}


function sectionTone(value: string): BadgeTone {
  if (value === "complete" || value === "verified") return "success";
  if (value === "submitted" || value === "in_progress") return "info";
  if (value === "missing" || value === "blocked") return "danger";
  return "warning";
}

function matchComplianceFromContractor(contractor: OpportunityProjectContractor) {
  if (contractor.compliance === "green") return "Ready" as const;
  if (contractor.compliance === "amber") return "Review Required" as const;
  return "Blocked" as const;
}

function matchBucketFromContractor(contractor: OpportunityProjectContractor) {
  if (contractor.status === "assigned") return "assigned" as const;
  if (contractor.status === "removed") return "rejected" as const;
  if (contractor.status === "watchlist") return "pending-review" as const;
  return "recommended" as const;
}

function workloadFromContractor(contractor: OpportunityProjectContractor) {
  if (contractor.status === "assigned") return "76% allocated";
  if (contractor.status === "removed") return "Not active";
  if (contractor.status === "watchlist") return "42% allocated";
  return "58% allocated";
}

function winRateFromContractor(contractor: OpportunityProjectContractor) {
  const projected = Math.round((contractor.aiMatch * 0.6) + (contractor.readiness * 0.4));
  return Math.max(35, Math.min(99, projected));
}

function buildOpportunityContractorMatches(project: OpportunityProjectWorkspace): ContractorMatchRecommendation[] {
  return project.contractors.map((contractor, index) => ({
    contractorId: contractor.id,
    contractorName: contractor.name,
    bucket: matchBucketFromContractor(contractor),
    readinessScore: contractor.readiness,
    compliance: matchComplianceFromContractor(contractor),
    experience: contractor.note,
    requiredCertifications: index % 2 === 0 ? ["CIDB Verified", "Tax Clear"] : ["CIDB Verified", "Municipal Vendor"],
    previousAwards: index % 2 === 0 ? ["2025 Waste Framework", "2024 Municipal Support"] : ["2025 Facilities Support"],
    currentWorkload: workloadFromContractor(contractor),
    winRate: winRateFromContractor(contractor),
    aiMatchScore: contractor.aiMatch,
    notes:
      contractor.status === "assigned"
        ? "Already attached to this opportunity in the presentation workspace."
        : contractor.status === "removed"
          ? "Rejected in the current presentation flow."
          : "Mock recommendation only.",
  }));
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: BadgeTone }) {
  return (
    <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
      <p className="tex-metric-label">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xl font-semibold text-[color:var(--tex-text-strong)]">{value}</p>
        {tone ? <Badge tone={tone}>{label}</Badge> : null}
      </div>
    </div>
  );
}

function ContractorsTab({ project }: { project: OpportunityProjectWorkspace }) {
  return (
    <ContractorMatchingPanel
      opportunityTitle={project.title}
      matches={buildOpportunityContractorMatches(project)}
    />
  );
}

function TabContent({ project, activeTab }: { project: OpportunityProjectWorkspace; activeTab: OpportunityProjectTabKey }) {
  if (activeTab === "contractors") {
    return <ContractorsTab project={project} />;
  }

  if (activeTab === "overview") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatRow label="Status" value={project.status.toUpperCase()} tone={toneFromProjectStatus(project.status)} />
        <StatRow label="Readiness" value={`${project.readiness}%`} tone="info" />
        <StatRow label="Risk" value={project.risk} tone={toneFromRisk(project.risk)} />
        <StatRow label="Value" value={project.value} tone="success" />
        <EnterprisePanel title="Project Summary" eyebrow="Opportunity project" className="md:col-span-2 xl:col-span-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="tex-metric-label">Opportunity</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">{project.title}</p>
              <p className="tex-copy mt-2 text-sm">{project.ref}</p>
            </div>
            <div>
              <p className="tex-metric-label">Assigned contractor</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">{project.contractor}</p>
              <p className="tex-copy mt-2 text-sm">{project.nextStep}</p>
            </div>
            <div>
              <p className="tex-metric-label">Presentation state</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">Mock project workspace</p>
              <p className="tex-copy mt-2 text-sm">No backend mutations are wired to this surface.</p>
            </div>
          </div>
        </EnterprisePanel>
      </div>
    );
  }

  if (activeTab === "documents") {
    return (
      <EnterprisePanel title="Documents" eyebrow="Project records">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {project.documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <p className="font-semibold text-[color:var(--tex-text-strong)]">{document.name}</p>
              <p className="tex-copy mt-1 text-sm">{document.type}</p>
              <div className="mt-4">
                <EnterpriseStatusBadge tone={sectionTone(document.status)} value={document.status} />
              </div>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "forms") {
    return (
      <EnterprisePanel title="Forms" eyebrow="SBD and supporting forms">
        <div className="grid gap-3 md:grid-cols-2">
          {project.forms.map((form) => (
            <div key={form.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <p className="font-semibold text-[color:var(--tex-text-strong)]">{form.name}</p>
              <div className="mt-3">
                <EnterpriseStatusBadge tone={sectionTone(form.status)} value={form.status} />
              </div>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "boq") {
    return (
      <EnterprisePanel title="BOQ" eyebrow="Commercial pricing structure">
        <div className="grid gap-3 md:grid-cols-2">
          {project.boq.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <p className="font-semibold text-[color:var(--tex-text-strong)]">{item.name}</p>
              <div className="mt-3">
                <EnterpriseStatusBadge tone={sectionTone(item.status)} value={item.status} />
              </div>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "tasks") {
    return (
      <EnterprisePanel title="Tasks" eyebrow="Project execution">
        <div className="space-y-3">
          {project.tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--tex-text-strong)]">{task.title}</p>
                  <p className="tex-copy mt-1 text-sm">Owner: {task.owner}</p>
                </div>
                <EnterpriseStatusBadge tone={sectionTone(task.status)} value={task.status} />
              </div>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "messages") {
    return (
      <EnterprisePanel title="Messages" eyebrow="Presentation thread">
        <div className="space-y-3">
          {project.messages.map((message) => (
            <div key={message.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[color:var(--tex-text-strong)]">{message.author}</p>
                  <p className="tex-copy mt-1 text-sm">{message.role}</p>
                </div>
                <span className="font-mono text-xs text-[color:var(--tex-text-muted)]">{message.createdAt}</span>
              </div>
              <p className="tex-copy mt-3 text-sm">{message.body}</p>
            </div>
          ))}
          <EnterpriseEmptyState title="Chat backend not connected" detail="This tab is presentation-only and uses mock messages." />
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "timeline") {
    return (
      <EnterprisePanel title="Timeline" eyebrow="Opportunity movement">
        <div className="space-y-3">
          {project.timeline.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-[color:var(--tex-text-strong)]">{item.label}</p>
                <span className="font-mono text-xs text-[color:var(--tex-text-muted)]">{item.timestamp}</span>
              </div>
              <p className="tex-copy mt-2 text-sm">{item.detail}</p>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "submission") {
    return (
      <EnterprisePanel title="Submission" eyebrow="Pack completion">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <EnterpriseKpiCard label={project.submission.title} value={project.submission.status.toUpperCase()} helper="Presentation only submission state." />
          <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
            <p className="tex-metric-label">Submission items</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--tex-text-strong)]">
              {project.submission.items.map((item) => (
                <li key={item} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">
                  <span>{item}</span>
                  <Badge tone="neutral">Mock</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </EnterprisePanel>
    );
  }

  if (activeTab === "audit") {
    return (
      <EnterprisePanel title="Audit" eyebrow="Traceability">
        <div className="space-y-3">
          {project.audit.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-[color:var(--tex-text-strong)]">{item.action}</p>
                <span className="font-mono text-xs text-[color:var(--tex-text-muted)]">{item.at}</span>
              </div>
              <p className="tex-copy mt-2 text-sm">Actor: {item.actor}</p>
            </div>
          ))}
        </div>
      </EnterprisePanel>
    );
  }

  return null;
}

export default function OpportunityProjectWorkspace() {
  const projects = useMemo(() => buildMockOpportunityProjects(), []);
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<OpportunityProjectTabKey>("overview");
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    const resolveTab = () => {
      const hash = window.location.hash.replace("#", "") as OpportunityProjectTabKey;
      if (TAB_ITEMS.some((item) => item.key === hash)) {
        setActiveTab(hash);
      }
    };

    resolveTab();
    window.addEventListener("hashchange", resolveTab);
    return () => window.removeEventListener("hashchange", resolveTab);
  }, []);

  if (!activeProject) {
    return <EnterpriseEmptyState title="No opportunity projects available" />;
  }

  return (
    <main className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Primary TEOS Workspace</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">Opportunity Workspace</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Every opportunity is presented as its own project with contractor controls, documents, forms, BOQ, tasks, messages, timeline, submission, and audit visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Presentation read model" tone="neutral" />
              <EnterpriseStatusBadge value="No backend mutations" tone="success" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
          <div>
            <p className="tex-metric-label">Operating Posture</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">Project-scoped opportunity control</p>
          </div>
          <div>
            <p className="tex-metric-label">Coverage</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">Mock opportunities only</p>
          </div>
          <div>
            <p className="tex-metric-label">Control Standard</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--tex-text-strong)]">Enterprise presentation layer</p>
          </div>
        </div>
      </EnterpriseCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <EnterprisePanel title="Projects" eyebrow="Opportunity list" className="h-full">
          <div className="space-y-3">
            {projects.map((project) => {
              const active = project.id === activeProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProjectId(project.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)]"
                      : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] hover:bg-[color:var(--tex-surface-muted)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[color:var(--tex-text-strong)]">{project.title}</p>
                      <p className="tex-copy mt-1 text-sm">{project.ref}</p>
                    </div>
                    <EnterpriseStatusBadge tone={toneFromProjectStatus(project.status)} value={project.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={toneFromRisk(project.risk)}>{project.risk}</Badge>
                    <Badge tone="info">{project.readiness}% readiness</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </EnterprisePanel>

        <EnterprisePanel title={activeProject.title} eyebrow={activeProject.ref} className="h-full">
          <div className="flex flex-wrap items-center gap-2">
            <EnterpriseStatusBadge tone={toneFromProjectStatus(activeProject.status)} value={activeProject.status} />
            <EnterpriseStatusBadge tone={toneFromRisk(activeProject.risk)} value={activeProject.risk} />
            <EnterpriseStatusBadge tone="info" value={`${activeProject.readiness}% readiness`} />
          </div>
          <p className="tex-copy mt-4 text-sm">{activeProject.nextStep}</p>

          <div className="mt-5">
            <OpportunityIntelligencePipeline
              opportunityTitle={activeProject.title}
              stages={mockOpportunityIntelligencePipeline}
            />
          </div>

          <div className="mt-5">
            <ContractorMatchingPanel
              opportunityTitle={activeProject.title}
              matches={buildOpportunityContractorMatches(activeProject)}
            />
          </div>

          <div className="mt-5">
            <EnterpriseTabs
              items={TAB_ITEMS.map((item) => ({
                key: item.key,
                label: item.label,
                href: `#${item.key}`,
              }))}
              active={activeTab}
            />
          </div>

          <div className="mt-5">
            <TabContent project={activeProject} activeTab={activeTab} />
          </div>
        </EnterprisePanel>
      </section>
    </main>
  );
}

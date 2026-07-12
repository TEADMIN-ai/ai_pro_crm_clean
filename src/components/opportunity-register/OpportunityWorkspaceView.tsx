import Link from "next/link";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import {
  formatOpportunityStatus,
  opportunityStatusTone,
  progressTone,
  readinessTone,
  type OpportunityRegisterRecord,
} from "@/components/opportunity-register/opportunityRegisterData";

function formatCurrency(value: number) {
  if (value >= 1_000_000) {
    return `R ${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `R ${(value / 1_000).toFixed(0)}k`;
  }

  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ChecklistTone({
  status,
}: {
  status: OpportunityRegisterRecord["readinessChecklist"][number]["status"];
}) {
  if (status === "complete") return <EnterpriseStatusBadge value="Complete" tone="success" />;
  if (status === "inReview") return <EnterpriseStatusBadge value="In review" tone="warning" />;
  if (status === "blocked") return <EnterpriseStatusBadge value="Blocked" tone="danger" />;
  return <EnterpriseStatusBadge value="Pending" tone="neutral" />;
}

export default function OpportunityWorkspaceView({ opportunity }: { opportunity: OpportunityRegisterRecord }) {
  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="tex-eyebrow">Opportunity Workspace</p>
              <h1 className="tex-title mt-3">{opportunity.rfqNumber}</h1>
              <p className="tex-copy mt-3 text-sm">
                {opportunity.client} - {opportunity.municipality} - {opportunity.department}
              </p>
              <p className="tex-copy mt-3 text-sm">{opportunity.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={formatOpportunityStatus(opportunity.status)} tone={opportunityStatusTone(opportunity.status)} />
              <EnterpriseStatusBadge value={`${opportunity.assignedContractors} contractors`} tone="info" />
              <EnterpriseStatusBadge value={`${opportunity.submissionProgress}% progress`} tone={progressTone(opportunity.submissionProgress)} />
              <EnterpriseStatusBadge value={`${opportunity.submissionReadiness}% ready`} tone={readinessTone(opportunity.submissionReadiness)} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Estimated Value" value={formatCurrency(opportunity.estimatedValue)} helper="Presentation estimate" />
          <EnterpriseKpiCard label="Assigned Contractors" value={opportunity.assignedContractors} helper="Contractors mapped to the scope" />
          <EnterpriseKpiCard label="Submission Readiness" value={`${opportunity.submissionReadiness}%`} helper={opportunity.riskNote} />
          <EnterpriseKpiCard label="Submission Progress" value={`${opportunity.submissionProgress}%`} helper={`Closing on ${formatDate(opportunity.closingDate)}`} />
        </div>
      </EnterpriseCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <EnterprisePanel
          eyebrow="Submission control"
          title="Readiness and contractor allocation"
          action={<EnterpriseStatusBadge value={opportunity.coordinator} tone="neutral" />}
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Submission readiness</p>
                <span className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{opportunity.submissionReadiness}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--tex-surface-muted)]">
                <div className="h-full rounded-full bg-[color:var(--tex-primary)]" style={{ width: `${opportunity.submissionReadiness}%` }} />
              </div>
              <p className="tex-copy mt-3 text-sm">{opportunity.riskNote}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {opportunity.contractors.map((contractor) => (
                <div key={contractor} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{contractor}</p>
                  <p className="tex-copy mt-1 text-xs">Assigned to this opportunity register entry.</p>
                </div>
              ))}
            </div>

            <EnterpriseEmptyState
              title="No mutations are attached to this workspace."
              detail="This view is presentation-only and exists to give the register a stable operational handoff surface."
            />
          </div>
        </EnterprisePanel>

        <EnterprisePanel eyebrow="Operational timeline" title="Opportunity timeline">
          <div className="space-y-3">
            {opportunity.timeline.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.label}</p>
                    <p className="tex-copy mt-1 text-sm">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">
                      {formatDate(item.date)}
                    </span>
                    <EnterpriseStatusBadge value={item.tone === "danger" ? "Critical" : item.tone === "warning" ? "Review" : "Track"} tone={item.tone} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </EnterprisePanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <EnterprisePanel eyebrow="Municipality breakdown" title="Municipality focus">
          <EnterpriseTable wrapperClassName="shadow-none">
            <thead>
              <tr>
                <th>Area</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {opportunity.municipalityBreakdown.map((item) => (
                <tr key={item.label}>
                  <td className="font-semibold text-[color:var(--tex-text-strong)]">{item.label}</td>
                  <td>
                    <EnterpriseStatusBadge value={item.value} tone={item.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </EnterpriseTable>
        </EnterprisePanel>

        <EnterprisePanel eyebrow="Department breakdown" title="Department focus">
          <EnterpriseTable wrapperClassName="shadow-none">
            <thead>
              <tr>
                <th>Area</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {opportunity.departmentBreakdown.map((item) => (
                <tr key={item.label}>
                  <td className="font-semibold text-[color:var(--tex-text-strong)]">{item.label}</td>
                  <td>
                    <EnterpriseStatusBadge value={item.value} tone={item.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </EnterpriseTable>
        </EnterprisePanel>
      </section>

      <EnterpriseCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="tex-eyebrow">Submission checklist</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">
              Work items connected to this opportunity
            </h2>
          </div>
          <EnterpriseActionButton href="/dashboard/opportunity-register" variant="secondary">
            Back to Register
          </EnterpriseActionButton>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {opportunity.readinessChecklist.map((item) => (
            <div key={item.label} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.label}</p>
                  <p className="tex-copy mt-1 text-sm">{item.detail}</p>
                </div>
                <ChecklistTone status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </EnterpriseCard>
    </main>
  );
}


"use client";

import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterprisePanel,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";
import {
  groupContractorMatches,
  type ContractorMatchAction,
  type ContractorMatchBucket,
  type ContractorMatchCompliance,
  type ContractorMatchRecommendation,
} from "@/lib/opportunities/contractorMatchingPresentation";

type Props = {
  opportunityTitle: string;
  matches: ContractorMatchRecommendation[];
  onAction?: (action: ContractorMatchAction, contractorId: string) => void;
};

const BUCKETS: Array<{ bucket: ContractorMatchBucket; title: string; detail: string }> = [
  { bucket: "recommended", title: "Recommended Contractors", detail: "Highest ranked contractors for the opportunity." },
  { bucket: "assigned", title: "Assigned Contractors", detail: "Contractors already attached to the opportunity." },
  { bucket: "pending-review", title: "Pending Review", detail: "Contractors that need a human review before selection." },
  { bucket: "rejected", title: "Rejected Contractors", detail: "Contractors excluded from the current opportunity." },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function complianceTone(compliance: ContractorMatchCompliance): EnterpriseTone {
  if (compliance === "Ready") return "success";
  if (compliance === "Blocked") return "danger";
  return "warning";
}

function scoreTone(score: number): EnterpriseTone {
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 55) return "warning";
  return "danger";
}

function bucketTone(bucket: ContractorMatchBucket): EnterpriseTone {
  if (bucket === "recommended") return "success";
  if (bucket === "assigned") return "info";
  if (bucket === "pending-review") return "warning";
  return "danger";
}

function ContractorMatchCard({ match, onAction }: { match: ContractorMatchRecommendation; onAction?: Props["onAction"] }) {
  const readiness = clampPercent(match.readinessScore);
  const aiScore = clampPercent(match.aiMatchScore);
  const winRate = clampPercent(match.winRate);

  return (
    <article className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--tex-text-strong)]">{match.contractorName}</h3>
          <p className="mt-1 font-mono text-xs font-medium text-[color:var(--tex-text-muted)]">{match.contractorId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnterpriseStatusBadge value={match.compliance} tone={complianceTone(match.compliance)} />
          <EnterpriseStatusBadge value={"AI Match " + aiScore + "%"} tone={scoreTone(aiScore)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
          <p className="tex-metric-label">Readiness</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--tex-text-strong)]">{readiness}%</p>
        </div>
        <div className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
          <p className="tex-metric-label">Compliance</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--tex-text-strong)]">{match.compliance}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
          <p className="tex-metric-label">AI Match</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--tex-text-strong)]">{aiScore}%</p>
        </div>
        <div className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
          <p className="tex-metric-label">Workload</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--tex-text-strong)]">{match.currentWorkload}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
          <p className="tex-metric-label">Win Rate</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--tex-text-strong)]">{winRate}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="tex-metric-label">Experience</p>
          <p className="tex-copy mt-2 text-sm">{match.experience}</p>
        </div>
        <div>
          <p className="tex-metric-label">Match Notes</p>
          <p className="tex-copy mt-2 text-sm">{match.notes ?? "Presentation-only contractor recommendation."}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="tex-metric-label">Required Certifications</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {match.requiredCertifications.map((value) => <span key={value} className="rounded-md border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-2 py-1 text-xs font-semibold text-[color:var(--tex-text-muted)]">{value}</span>)}
          </div>
        </div>
        <div>
          <p className="tex-metric-label">Previous Awards</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {match.previousAwards.map((value) => <span key={value} className="rounded-md border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-2 py-1 text-xs font-semibold text-[color:var(--tex-text-muted)]">{value}</span>)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <EnterpriseActionButton variant="success" onClick={() => onAction?.("assign", match.contractorId)}>Assign</EnterpriseActionButton>
        <EnterpriseActionButton variant="secondary" onClick={() => onAction?.("review", match.contractorId)}>Review</EnterpriseActionButton>
        <EnterpriseActionButton variant="warning" onClick={() => onAction?.("compare", match.contractorId)}>Compare</EnterpriseActionButton>
        <EnterpriseActionButton href={`/dashboard/contractors/${match.contractorId}`} variant="secondary">Open Contractor Profile</EnterpriseActionButton>
      </div>
    </article>
  );
}

export default function ContractorMatchingPanel({ opportunityTitle, matches, onAction }: Props) {
  const grouped = groupContractorMatches(matches);

  return (
    <EnterpriseCard className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="tex-eyebrow">Contractor Matching</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--tex-text-strong)]">Recommended contractors</h2>
          <p className="tex-copy mt-2 text-sm">{opportunityTitle}</p>
        </div>
        <EnterpriseStatusBadge value="Presentation only" tone="neutral" />
      </div>
      <div className="mt-6 grid gap-5">
        {BUCKETS.map((bucket) => {
          const items = grouped[bucket.bucket];
          return (
            <EnterprisePanel key={bucket.bucket} title={bucket.title} eyebrow={bucket.detail} action={<EnterpriseStatusBadge tone={bucketTone(bucket.bucket)} value={items.length + (items.length === 1 ? ' contractor' : ' contractors')} />}>
              {items.length ? (
                <div className="grid gap-4">
                  {items.map((match) => (
                    <ContractorMatchCard key={match.contractorId} match={match} onAction={onAction} />
                  ))}
                </div>
              ) : (
                <EnterpriseEmptyState title={"No " + bucket.title.toLowerCase()} detail="This opportunity does not currently have mock contractor records in this category." />
              )}
            </EnterprisePanel>
          );
        })}
      </div>
    </EnterpriseCard>
  );
}

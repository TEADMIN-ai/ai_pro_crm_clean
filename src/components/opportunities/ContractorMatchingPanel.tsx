"use client";

import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseStatusBadge,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";
import {
  sortContractorMatchesByScore,
  type ContractorMatchAction,
  type ContractorMatchCompliance,
  type ContractorMatchRecommendation,
} from "@/lib/opportunities/contractorMatchingPresentation";

type Props = {
  opportunityTitle: string;
  matches: ContractorMatchRecommendation[];
  onAction?: (action: ContractorMatchAction, contractorId: string) => void;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function complianceTone(compliance: ContractorMatchCompliance): EnterpriseTone {
  if (compliance === "Ready") {
    return "success";
  }

  if (compliance === "Blocked") {
    return "danger";
  }

  return "warning";
}

function scoreTone(score: number): EnterpriseTone {
  if (score >= 85) {
    return "success";
  }

  if (score >= 70) {
    return "info";
  }

  if (score >= 55) {
    return "warning";
  }

  return "danger";
}

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: EnterpriseTone }) {
  const percent = clampPercent(value);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="tex-metric-label">{label}</span>
        <EnterpriseStatusBadge value={`${percent}%`} tone={tone} />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--tex-surface-muted)]">
        <div className="h-full rounded-full bg-[color:var(--tex-accent)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CompactList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="min-w-0">
      <p className="tex-metric-label">{label}</p>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-md border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-2 py-1 text-xs font-semibold text-[color:var(--tex-text-muted)]"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="tex-copy mt-2 text-sm">Not recorded</p>
      )}
    </div>
  );
}

function ContractorMatchCard({
  match,
  onAction,
}: {
  match: ContractorMatchRecommendation;
  onAction?: Props["onAction"];
}) {
  const aiScore = clampPercent(match.aiMatchScore);
  const readinessScore = clampPercent(match.readinessScore);

  return (
    <article className="rounded-lg border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[color:var(--tex-text-strong)]">
                {match.contractorName}
              </h3>
              <p className="mt-1 font-mono text-xs font-medium text-[color:var(--tex-text-muted)]">
                {match.contractorId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={match.compliance} tone={complianceTone(match.compliance)} />
              <EnterpriseStatusBadge value={`AI Match ${aiScore}%`} tone={scoreTone(aiScore)} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ScoreBar label="Readiness Score" value={readinessScore} tone={scoreTone(readinessScore)} />
            <ScoreBar label="AI Match Score" value={aiScore} tone={scoreTone(aiScore)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="tex-metric-label">Experience</p>
              <p className="tex-copy mt-2 text-sm">{match.experience}</p>
            </div>
            <div>
              <p className="tex-metric-label">Current Workload</p>
              <p className="tex-copy mt-2 text-sm">{match.currentWorkload}</p>
            </div>
            <CompactList label="Required Certifications" values={match.requiredCertifications} />
            <CompactList label="Previous Awards" values={match.previousAwards} />
          </div>

          {match.notes ? <p className="tex-copy mt-4 text-sm">{match.notes}</p> : null}
        </div>

        <div className="grid content-start gap-2">
          <EnterpriseActionButton variant="success" onClick={() => onAction?.("assign", match.contractorId)}>
            Assign
          </EnterpriseActionButton>
          <EnterpriseActionButton variant="secondary" onClick={() => onAction?.("review", match.contractorId)}>
            Review
          </EnterpriseActionButton>
          <EnterpriseActionButton variant="danger" onClick={() => onAction?.("reject", match.contractorId)}>
            Reject
          </EnterpriseActionButton>
        </div>
      </div>
    </article>
  );
}

export default function ContractorMatchingPanel({ opportunityTitle, matches, onAction }: Props) {
  const sortedMatches = sortContractorMatchesByScore(matches);

  return (
    <EnterpriseCard className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="tex-eyebrow">Contractor Matching</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--tex-text-strong)]">
            Recommended contractors
          </h2>
          <p className="tex-copy mt-2 text-sm">{opportunityTitle}</p>
        </div>
        <EnterpriseStatusBadge value="Highest match first" tone="info" />
      </div>

      <div className="mt-5 grid gap-4">
        {sortedMatches.length ? (
          sortedMatches.map((match) => (
            <ContractorMatchCard key={match.contractorId} match={match} onAction={onAction} />
          ))
        ) : (
          <EnterpriseEmptyState
            title="No contractor recommendations"
            detail="Contractor matching data has not been connected for this opportunity."
          />
        )}
      </div>
    </EnterpriseCard>
  );
}


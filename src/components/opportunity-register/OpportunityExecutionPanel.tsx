"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EnterpriseActionButton, EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge, EnterpriseTable } from "@/components/ui/EnterpriseUI";
import type { ContractorMatchResult, OpportunityAction, OpportunityActionKey, OpportunityExecutionState, OpportunityRequirementReview, OpportunityStageStatus } from "@/lib/opportunities/opportunityExecution";

type Props = { dealId: string; state: OpportunityExecutionState; matches: ContractorMatchResult[] };

const PRIMARY_ACTIONS: OpportunityActionKey[] = [
  "start_compliance_review",
  "open_missing_documents",
  "open_boq_pricing",
  "prepare_documents",
  "start_internal_review",
  "contractor_approval",
  "generate_tender_pack",
  "record_submission",
];

function fieldValue(value: string | null | undefined) { return value ?? ""; }
function formatDate(value: string | null) {
  if (!value) return "Not captured";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function formatAssignmentDate(value: string | null) { return value ? formatDate(value) : "Not recorded"; }
function statusTone(status: OpportunityStageStatus) {
  if (status === "COMPLETE") return "success" as const;
  if (status === "BLOCKED") return "danger" as const;
  if (status === "IN_PROGRESS") return "warning" as const;
  if (status === "NOT_APPLICABLE") return "neutral" as const;
  return "notStarted" as const;
}
function actionByKey(actions: OpportunityAction[], key: OpportunityActionKey) {
  return actions.find((action) => action.key === key);
}

export default function OpportunityExecutionPanel({ dealId, state, matches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<OpportunityRequirementReview>(state.requirements);

  useEffect(() => {
    setRequirements(state.requirements);
  }, [state.requirements]);

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setError(null);
    const response = await fetch("/api/opportunity-register/" + encodeURIComponent(dealId) + "/execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Workflow action failed");
    if (typeof payload.redirectTo === "string") router.push(payload.redirectTo);
    else router.refresh();
  }

  function submit(action: string, extra: Record<string, unknown> = {}) {
    startTransition(() => {
      void runAction(action, extra).catch((err) => setError(err instanceof Error ? err.message : "Workflow action failed"));
    });
  }

  function setRequirement(key: keyof OpportunityRequirementReview, value: string | boolean) {
    setRequirements((current) => ({ ...current, [key]: value }));
  }

  function renderAction(action: OpportunityAction | undefined) {
    if (!action) return null;
    if (action.href && action.enabled) {
      return <EnterpriseActionButton key={action.key} href={action.href} variant="secondary">{action.label}</EnterpriseActionButton>;
    }
    if (action.href) {
      return (
        <EnterpriseActionButton key={action.key} disabled variant="secondary" title={action.reason ?? undefined}>
          {action.label}
        </EnterpriseActionButton>
      );
    }
    return (
      <EnterpriseActionButton key={action.key} disabled={pending || !action.enabled} variant={action.enabled ? "success" : "secondary"} onClick={() => submit(action.key)} title={action.reason ?? undefined}>
        {action.label}
      </EnterpriseActionButton>
    );
  }

  const primaryActions = PRIMARY_ACTIONS.map((key) => actionByKey(state.actions, key)).filter(Boolean) as OpportunityAction[];
  const nonPrimaryEnabled = state.actions.filter((action) => action.enabled && !PRIMARY_ACTIONS.includes(action.key));
  const blockedPrimary = primaryActions.filter((action) => !action.enabled);

  return (
    <div className="grid gap-6">
      <EnterprisePanel eyebrow="Next action" title={"Next action: " + state.nextActionDetail.label} action={<EnterpriseStatusBadge value={state.currentPhase} tone="info" />}>
        <div className="grid gap-4 lg:grid-cols-4">
          <div><p className="tex-metric-label">Owner</p><p className="mt-1 font-semibold">{state.nextActionDetail.owner}</p></div>
          <div><p className="tex-metric-label">Due before</p><p className="mt-1 font-semibold">{formatDate(state.nextActionDetail.dueBefore)}</p></div>
          <div><p className="tex-metric-label">Days remaining</p><p className="mt-1 font-semibold">{state.daysRemaining === null ? "Not captured" : state.daysRemaining}</p></div>
          <div><p className="tex-metric-label">Workflow progress</p><p className="mt-1 font-semibold">{state.readiness}%</p></div>
        </div>
        {state.nextActionDetail.blocker ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{state.nextActionDetail.blocker}</div> : null}
        {state.blockers.length ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{state.blockers.join("; ")}</div> : null}
        {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div> : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Stages" title="Tender execution stages">
        <div className="grid gap-3 lg:grid-cols-3">
          {state.stages.map((stage) => (
            <article key={stage.key} className="rounded-md border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[color:var(--tex-text-strong)]">{stage.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase text-[color:var(--tex-text-muted)]">Owner: {stage.owner}</p>
                </div>
                <EnterpriseStatusBadge value={stage.status} tone={statusTone(stage.status)} />
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--tex-text-muted)]">{stage.summary}</p>
              {stage.blockers.length ? <ul className="mt-3 grid gap-1 text-sm text-red-800">{stage.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
            </article>
          ))}
        </div>
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Actions" title="Operational controls">
        <div className="flex flex-wrap gap-2">
          {primaryActions.map(renderAction)}
          {nonPrimaryEnabled.map(renderAction)}
        </div>
        {blockedPrimary.length ? (
          <div className="mt-4 grid gap-2">
            {blockedPrimary.map((action) => <div key={action.key} className="rounded-md border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-3 text-sm"><span className="font-semibold">{action.label}:</span> {action.reason}</div>)}
          </div>
        ) : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Contractor assignment" title={state.assignment.complete ? state.assignment.contractorName ?? "Assigned contractor" : "No contractor assigned"} action={<EnterpriseStatusBadge value={state.assignment.assignmentStatus} tone={state.assignment.complete ? "success" : "warning"} />}>
        <div className="grid gap-4 md:grid-cols-3">
          <div><p className="tex-metric-label">Business name</p><p className="mt-1 font-semibold">{state.assignment.contractorName ?? "No contractor assigned"}</p></div>
          <div><p className="tex-metric-label">Contractor ID</p><p className="mt-1 font-semibold">{state.assignment.contractorId ?? "Not resolved"}</p></div>
          <div><p className="tex-metric-label">Assignment date</p><p className="mt-1 font-semibold">{formatAssignmentDate(state.assignment.assignedAt)}</p></div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div><p className="tex-metric-label">Assigned by</p><p className="mt-1 font-semibold">{state.assignment.assignedByEmail ?? state.assignment.assignedBy ?? "Not recorded"}</p></div>
          <div><p className="tex-metric-label">Workspace</p><p className="mt-1 font-semibold">{state.assignment.workspaceId ?? "Not captured"}</p></div>
          <div><p className="tex-metric-label">Submission review</p><p className="mt-1 font-semibold">{state.submissionReviewConnected ? "Connected" : "Not connected"}</p></div>
        </div>
        {state.assignment.assignmentReason ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{state.assignment.assignmentReason}</div> : null}
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Compliance" title="Compulsory contractor checks">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[color:var(--tex-border)] p-3"><p className="tex-metric-label">Profile completeness</p><p className="mt-1 font-semibold">{state.profileCompleteness}%</p></div>
          <div className="rounded-md border border-[color:var(--tex-border)] p-3"><p className="tex-metric-label">General compliance</p><p className="mt-1 font-semibold">{state.generalCompliance}%</p></div>
          <div className="rounded-md border border-[color:var(--tex-border)] p-3"><p className="tex-metric-label">Opportunity match</p><p className="mt-1 font-semibold">{state.opportunityMatch}%</p></div>
          <div className="rounded-md border border-[color:var(--tex-border)] p-3"><p className="tex-metric-label">Submission readiness</p><p className="mt-1 font-semibold">{state.submissionReadiness}%</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {state.complianceRequirements.map((check) => (
            <details key={check.key} className="rounded-md border border-[color:var(--tex-border)] p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{check.requirementName}</p>
                  <EnterpriseStatusBadge value={check.status} tone={check.status === "VALID" ? "success" : check.status === "NOT_APPLICABLE" ? "neutral" : check.blockerSeverity === "review" ? "warning" : "danger"} />
                </div>
                <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">{check.required ? "Required" : "Not required"}</p>
              </summary>
              <div className="mt-3 grid gap-2 text-sm">
                <p>{check.reason}</p>
                <p><span className="font-semibold">Action:</span> {check.requiredAction}</p>
                <p><span className="font-semibold">Responsible:</span> {check.responsiblePerson}</p>
                <p><span className="font-semibold">Due:</span> {formatDate(check.dueDate)}</p>
                {check.matchedDocument ? <p><span className="font-semibold">Document:</span> {check.matchedDocument.originalFilename ?? check.matchedDocument.documentId ?? "Document recorded"}</p> : null}
                {check.expiryDate ? <p><span className="font-semibold">Valid until:</span> {check.expiryDate}</p> : null}
              </div>
            </details>
          ))}
        </div>
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Document preparation" title="Returnables and pack inputs">
        <div className="grid gap-3 md:grid-cols-2">
          {state.documentChecklist.map((item) => (
            <div key={item.key} className="rounded-md border border-[color:var(--tex-border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{item.label}</p>
                <EnterpriseStatusBadge value={item.status} tone={statusTone(item.status)} />
              </div>
              <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">{item.required ? "Required" : "Not applicable"}{item.source ? " - " + item.source : ""}</p>
            </div>
          ))}
        </div>
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Requirements review" title="Extracted tender requirements">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-md border p-2" value={fieldValue(requirements.rfqNumber)} onChange={(event) => setRequirement("rfqNumber", event.target.value)} placeholder="RFQ/RFP number" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.clientIssuer)} onChange={(event) => setRequirement("clientIssuer", event.target.value)} placeholder="Client / issuer" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.municipalityOrOrganOfState)} onChange={(event) => setRequirement("municipalityOrOrganOfState", event.target.value)} placeholder="Municipality / organ of state" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.department)} onChange={(event) => setRequirement("department", event.target.value)} placeholder="Department" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.closingDateTime)} onChange={(event) => setRequirement("closingDateTime", event.target.value)} placeholder="Closing date/time" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.serviceCategory)} onChange={(event) => setRequirement("serviceCategory", event.target.value)} placeholder="Service category" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.location)} onChange={(event) => setRequirement("location", event.target.value)} placeholder="Location" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.cidbRequirement)} onChange={(event) => setRequirement("cidbRequirement", event.target.value)} placeholder="CIDB requirement" />
          <input className="rounded-md border p-2" value={fieldValue(requirements.submissionMethod)} onChange={(event) => setRequirement("submissionMethod", event.target.value)} placeholder="Submission method" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {(["csdRequirement", "taxRequirement", "bbbeeRequirement", "coidaRequirement", "bankingRequirement", "boqPricingSchedulePresent", "signatureRequired"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(requirements[key])} onChange={(event) => setRequirement(key, event.target.checked)} />{key}</label>
          ))}
        </div>
        <div className="mt-4"><EnterpriseActionButton disabled={pending || state.currentPhase !== "REQUIREMENTS_REVIEW"} onClick={() => submit("review_requirements", { requirements })} variant="success">Complete Requirements Review</EnterpriseActionButton></div>
      </EnterprisePanel>

      <EnterprisePanel eyebrow="Contractor matching" title="Live contractor recommendations">
        {matches.length ? <EnterpriseTable wrapperClassName="shadow-none">
          <thead><tr><th>Contractor</th><th>Opportunity match</th><th>Profile</th><th>General compliance</th><th>Submission readiness</th><th>Counts</th><th>Reason</th><th>Action</th></tr></thead>
          <tbody>{matches.map((match) => (
            <tr key={match.contractorId}>
              <td>
                <p className="font-semibold">{match.contractorName}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-[color:var(--tex-text-muted)]">Compliance details</summary>
                  <div className="mt-2 grid gap-2">
                    {match.complianceDetails.map((detail) => (
                      <div key={detail.key} className="rounded-md border border-[color:var(--tex-border)] p-2 text-xs">
                        <p className="font-semibold">{detail.requirementName}: {detail.status}</p>
                        <p>{detail.reason}</p>
                        <p>Action: {detail.requiredAction}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </td>
              <td>{match.opportunityMatch}%</td>
              <td>{match.profileCompleteness}%</td>
              <td>{match.generalCompliance}%</td>
              <td>{match.submissionReadiness}%</td>
              <td>{match.validRequirementsCount} valid / {match.missingCount} missing / {match.expiredCount} expired / {match.reviewRequiredCount} review</td>
              <td>{match.recommendationReason}</td>
              <td><EnterpriseActionButton disabled={pending || state.currentPhase !== "MATCHING_REQUIRED" || match.assignmentAllowed !== true} onClick={() => submit("assign_contractor", { contractorId: match.contractorId })} variant={match.assignmentAllowed === true ? "success" : "secondary"} title={match.blockingReasons[0] ?? undefined}>Assign</EnterpriseActionButton></td>
            </tr>
          ))}</tbody>
        </EnterpriseTable> : <EnterpriseEmptyState title="No live contractor matches" detail="No canonical contractor records matched this opportunity." />}
      </EnterprisePanel>
    </div>
  );
}

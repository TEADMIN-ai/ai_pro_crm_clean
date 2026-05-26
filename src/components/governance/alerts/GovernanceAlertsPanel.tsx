"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import type { GovernanceAlertWithWorkflow, GovernanceWorkflowState } from "@/lib/governance/workflows";
import type { GovernanceAlertSeverity } from "@/lib/governance/alerts";

function badgeTone(severity: GovernanceAlertSeverity): "neutral" | "warning" | "danger" | "info" {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return "danger";
    case "MODERATE":
      return "warning";
    case "LOW":
    default:
      return "info";
  }
}

function workflowTone(state: GovernanceWorkflowState): "neutral" | "warning" | "danger" | "info" | "success" {
  switch (state) {
    case "ESCALATED":
      return "danger";
    case "INVESTIGATING":
      return "warning";
    case "ACKNOWLEDGED":
      return "info";
    case "RESOLVED":
      return "success";
    case "NEW":
    default:
      return "neutral";
  }
}

type WorkflowAction = "acknowledge" | "investigating" | "escalate" | "resolve";

function GovernanceAlertCard({ alert }: { alert: GovernanceAlertWithWorkflow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(alert.workflow.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: WorkflowAction) {
    setError(null);

    const response = await authFetch(API_ROUTES.GOVERNANCE_ALERT_WORKFLOW(alert.id), {
      method: "PATCH",
      body: JSON.stringify({
        action,
        note: note.trim() || null,
        alert,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to update governance workflow");
    }
  }

  function onAction(action: WorkflowAction) {
    startTransition(() => {
      void runAction(action)
        .then(() => router.refresh())
        .catch((nextError) => {
          console.error("Governance workflow action failed", nextError);
          setError(nextError instanceof Error ? nextError.message : "Workflow update failed");
        });
    });
  }

  return (
    <article className="governance-alert-card">
      <div className="governance-feed-meta">
        <span>{new Date(alert.observedAt).toLocaleString()}</span>
        <span>{alert.alertType}</span>
      </div>
      <div className="governance-alert-head">
        <div>
          <h3 className="governance-feed-title">{alert.title}</h3>
          <p className="governance-feed-context">{alert.summary}</p>
        </div>
        <div className="governance-alert-badge-stack">
          <Badge tone={badgeTone(alert.severity)}>{alert.severity}</Badge>
          <Badge tone={workflowTone(alert.workflow.workflowState)}>{alert.workflow.workflowState}</Badge>
        </div>
      </div>

      <div className="governance-alert-metrics">
        {alert.sourceName ? <Badge tone="neutral">{alert.sourceName}</Badge> : null}
        {alert.routeClassification ? <Badge tone="info">{alert.routeClassification}</Badge> : null}
        {typeof alert.metrics.activityFrequency === "number" ? (
          <Badge tone="neutral">Activity {alert.metrics.activityFrequency}</Badge>
        ) : null}
        {typeof alert.metrics.divergenceFrequency === "number" ? (
          <Badge tone="warning">Divergence {alert.metrics.divergenceFrequency}</Badge>
        ) : null}
        {typeof alert.metrics.staleStateCompensationFrequency === "number" ? (
          <Badge tone="warning">Stale {alert.metrics.staleStateCompensationFrequency}</Badge>
        ) : null}
        {typeof alert.metrics.canonicalCorrectionFrequency === "number" ? (
          <Badge tone="danger">Corrections {alert.metrics.canonicalCorrectionFrequency}</Badge>
        ) : null}
        {typeof alert.metrics.noopRecomputeFrequency === "number" ? (
          <Badge tone="neutral">No-op {alert.metrics.noopRecomputeFrequency}</Badge>
        ) : null}
      </div>

      <div className="governance-workflow-meta">
        <span>Operator: {alert.workflow.operatorEmail ?? alert.workflow.operatorId ?? "Unassigned"}</span>
        <span>Updated: {new Date(alert.workflow.updatedAt).toLocaleString()}</span>
      </div>

      <div className="governance-workflow-meta">
        <span>Acknowledged: {alert.workflow.acknowledgedAt ? new Date(alert.workflow.acknowledgedAt).toLocaleString() : "Not yet"}</span>
        <span>Resolved: {alert.workflow.resolvedAt ? new Date(alert.workflow.resolvedAt).toLocaleString() : "Open"}</span>
      </div>

      <label className="governance-workflow-note">
        <span>Governance Note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional operator note"
          className="governance-workflow-note-input"
          rows={2}
          disabled={isPending}
        />
      </label>

      <div className="governance-workflow-actions">
        <button type="button" className="governance-action-button tone-info" onClick={() => onAction("acknowledge")} disabled={isPending}>
          Acknowledge
        </button>
        <button type="button" className="governance-action-button tone-warning" onClick={() => onAction("investigating")} disabled={isPending}>
          Investigate
        </button>
        <button type="button" className="governance-action-button tone-danger" onClick={() => onAction("escalate")} disabled={isPending}>
          Escalate
        </button>
        <button type="button" className="governance-action-button tone-success" onClick={() => onAction("resolve")} disabled={isPending}>
          Resolve
        </button>
      </div>

      {error ? <p className="governance-workflow-error">{error}</p> : null}
    </article>
  );
}

export default function GovernanceAlertsPanel({
  alerts,
}: {
  alerts: GovernanceAlertWithWorkflow[];
}) {
  return (
    <Card>
      <div className="governance-section-header">
        <div>
          <p className="dashboard-eyebrow">Passive Governance Alerts</p>
          <h2 className="governance-section-title">Escalation visibility</h2>
        </div>
        <Badge tone={alerts.length > 0 ? "warning" : "success"}>
          {alerts.length > 0 ? `${alerts.length} active` : "Stable"}
        </Badge>
      </div>

      <div className="governance-alert-list">
        {alerts.length === 0 ? (
          <div className="governance-feed-empty">
            No passive governance alerts are active in this process snapshot.
          </div>
        ) : (
          alerts.map((alert) => <GovernanceAlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </Card>
  );
}

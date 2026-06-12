"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RequireRole from "@/components/auth/RequireRole";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";
import type { IntelligenceCenterOverview } from "@/types/intelligenceCenter";

const EMPTY_OVERVIEW: IntelligenceCenterOverview = {
  metrics: {
    totalContractors: 0,
    newContractors: 0,
    readyContractors: 0,
    riskContractors: 0,
    blockedContractors: 0,
    documentsUploadedToday: 0,
    aiAnalysesToday: 0,
    tenderPacksGenerated: 0,
    userActivityToday: 0,
  },
  auditLogs: [],
  recentTeamActivity: [],
  decisionLogs: [],
  systemMetrics: [],
  complianceAlerts: [],
};

function metricLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function severityTone(severity: string): "success" | "warning" | "danger" | "info" {
  if (severity === "expired") return "danger";
  if (severity === "expiringSoon") return "warning";
  return "info";
}

function reportHref(format: "csv" | "excel" | "pdf", period: "daily" | "weekly" | "monthly") {
  return `/api/intelligence-center/reports?format=${format}&period=${period}`;
}

export default function IntelligenceCenterPage() {
  const [overview, setOverview] = useState<IntelligenceCenterOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setLoading(true);
        const response = await authFetch("/api/intelligence-center/overview", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Intelligence Center request failed (${response.status})`);
        }
        const data = (await response.json()) as IntelligenceCenterOverview;
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Intelligence Center unavailable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  async function reprocessFailedDocuments() {
    try {
      setBulkStatus("Reprocessing failed documents...");
      const response = await authFetch("/api/contractor-documents/reprocess-failed", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        reprocessed?: number;
        failed?: number;
        scanned?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Bulk reprocess failed (${response.status})`);
      }

      setBulkStatus(`Reprocessed ${data?.reprocessed ?? 0} of ${data?.scanned ?? 0}; failed ${data?.failed ?? 0}.`);
    } catch (bulkError) {
      setBulkStatus(bulkError instanceof Error ? bulkError.message : "Bulk reprocess failed");
    }
  }

  const latestDecision = overview.decisionLogs[0] ?? null;
  const averageApiDuration = useMemo(() => {
    const durations = overview.systemMetrics
      .map((metric) => metric.durationMs)
      .filter((value): value is number => typeof value === "number");
    return durations.length > 0
      ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
      : 0;
  }, [overview.systemMetrics]);

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <div className="enterprise-page enterprise-grid">
        <Card>
          <IdentityCardHeader
            title="Audit & Intelligence Center"
            subtitle="Read-only operational visibility across audit logs, decisions, compliance alerts, reports, and system metrics"
          >
            <Badge tone={loading ? "warning" : "success"}>{loading ? "Loading" : "Live Read Model"}</Badge>
            <Badge tone="info">Black Box</Badge>
          </IdentityCardHeader>
          {error ? (
            <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
        </Card>

        <div className="enterprise-grid-metrics">
          {Object.entries(overview.metrics).map(([key, value]) => (
            <Card key={key}>
              <p className="enterprise-metric-label">{metricLabel(key)}</p>
              <h2 className="enterprise-metric-value">{value.toLocaleString()}</h2>
            </Card>
          ))}
        </div>

        <Card>
          <IdentityCardHeader title="Executive Reports" subtitle="Export read-only intelligence snapshots">
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white no-underline" href={reportHref("csv", "daily")}>
                CSV
              </Link>
              <Link className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white no-underline" href={reportHref("excel", "weekly")}>
                Excel
              </Link>
              <Link className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white no-underline" href={reportHref("pdf", "monthly")}>
                PDF
              </Link>
            </div>
          </IdentityCardHeader>
        </Card>

        <Card>
          <IdentityCardHeader title="Recent Team Activity" subtitle="Latest operational actions across contractor workspaces">
            <button
              type="button"
              onClick={reprocessFailedDocuments}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Reprocess Failed Documents
            </button>
          </IdentityCardHeader>
          {bulkStatus ? <p className="mt-3 text-sm text-slate-300">{bulkStatus}</p> : null}
          <div className="mt-4 grid gap-3">
            {overview.recentTeamActivity.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3">
                <p className="text-sm font-semibold text-slate-100">
                  {String(activity.metadata.actorName ?? "System")} - {activity.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {activity.contractorId || "n/a"} {activity.targetId ? `- ${activity.targetId}` : ""} - {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
            {overview.recentTeamActivity.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
                No recent team activity recorded yet.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <IdentityCardHeader title="Decision Tracking" subtitle="Readiness and decision explainability">
            <Badge tone={latestDecision ? "info" : "warning"}>
              {latestDecision ? "Decision Logs Available" : "Awaiting Decision Logs"}
            </Badge>
          </IdentityCardHeader>
          <Table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Contractor</th>
                <th>Previous</th>
                <th>New</th>
                <th>Trigger</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {overview.decisionLogs.slice(0, 8).map((decision) => (
                <tr key={decision.id}>
                  <td>{new Date(decision.timestamp).toLocaleString()}</td>
                  <td>{decision.contractorId ?? "n/a"}</td>
                  <td>{decision.previousReadinessScore ?? "n/a"}</td>
                  <td>{decision.newReadinessScore ?? "n/a"}</td>
                  <td>{decision.triggerEvent ?? "n/a"}</td>
                  <td>{decision.reasonForChange ?? "No reason recorded"}</td>
                </tr>
              ))}
              {overview.decisionLogs.length === 0 ? (
                <tr>
                  <td colSpan={6}>No decision logs recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card>
          <IdentityCardHeader title="Compliance Intelligence" subtitle="Expiry monitoring across contractor documents">
            <Badge tone={overview.complianceAlerts.length > 0 ? "warning" : "success"}>
              {overview.complianceAlerts.length} Alerts
            </Badge>
          </IdentityCardHeader>
          <Table>
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Document</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {overview.complianceAlerts.slice(0, 10).map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.contractorName}</td>
                  <td>{alert.documentType}</td>
                  <td>{new Date(alert.expiresAt).toLocaleDateString()}</td>
                  <td><Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge></td>
                  <td>{alert.daysUntilExpiry}</td>
                </tr>
              ))}
              {overview.complianceAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5}>No expiry alerts detected.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card>
          <IdentityCardHeader title="Activity Timeline" subtitle="Latest audit stream across observed events">
            <Badge tone="info">{overview.auditLogs.length} Events</Badge>
          </IdentityCardHeader>
          <Table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Contractor</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {overview.auditLogs.slice(0, 12).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.eventType}</td>
                  <td>{log.actorId ?? "system"}</td>
                  <td>{log.contractorId ?? "n/a"}</td>
                  <td>{log.targetId ?? "n/a"}</td>
                </tr>
              ))}
              {overview.auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>No audit events recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card>
          <IdentityCardHeader title="Performance Monitoring" subtitle="Captured API, analysis, PDF, and storage durations">
            <Badge tone={averageApiDuration > 0 ? "info" : "warning"}>
              Avg {averageApiDuration}ms
            </Badge>
          </IdentityCardHeader>
          <Table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Metric</th>
                <th>Route</th>
                <th>Duration</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {overview.systemMetrics.slice(0, 10).map((metric) => (
                <tr key={metric.id}>
                  <td>{new Date(metric.timestamp).toLocaleString()}</td>
                  <td>{metric.metricType}</td>
                  <td>{metric.route ?? "n/a"}</td>
                  <td>{metric.durationMs ?? "n/a"}ms</td>
                  <td>{metric.targetId ?? metric.contractorId ?? "n/a"}</td>
                </tr>
              ))}
              {overview.systemMetrics.length === 0 ? (
                <tr>
                  <td colSpan={5}>No system metrics recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>
    </RequireRole>
  );
}

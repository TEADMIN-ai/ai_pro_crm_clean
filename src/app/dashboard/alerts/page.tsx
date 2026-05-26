"use client";

import { useEffect, useMemo, useState } from "react";
import { getEscalationLevel } from "@/lib/automation/getEscalationLevel";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";

type AlertTypeFilter = "ALL" | "CRITICAL" | "WARNING" | "ERROR";
type ResolutionFilter = "ALL" | "ACTIVE" | "RESOLVED";

type AutomationAlert = {
  id: string;
  contractorId: string;
  type: "CRITICAL" | "WARNING" | "ERROR";
  code: string;
  message: string;
  createdAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to load system alerts.";
}

function getTypeClasses(type: AutomationAlert["type"]): string {
  switch (type) {
    case "CRITICAL":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "WARNING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ERROR":
    default:
      return "border-orange-200 bg-orange-50 text-orange-700";
  }
}

function getTypeBadgeTone(type: AutomationAlert["type"]) {
  switch (type) {
    case "CRITICAL":
      return "danger" as const;
    case "WARNING":
      return "warning" as const;
    case "ERROR":
    default:
      return "info" as const;
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Unknown time";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function getEscalationOrder(level: ReturnType<typeof getEscalationLevel>): number {
  switch (level) {
    case "CRITICAL_ESCALATED":
      return 0;
    case "WARNING":
      return 2;
    case "NORMAL":
      return 3;
    case "RESOLVED":
    default:
      return 4;
  }
}

function getAlertTypeOrder(type: AutomationAlert["type"]): number {
  switch (type) {
    case "CRITICAL":
      return 1;
    case "WARNING":
      return 2;
    case "ERROR":
    default:
      return 3;
  }
}

function getEscalationCardClasses(level: ReturnType<typeof getEscalationLevel>): string {
  switch (level) {
    case "CRITICAL_ESCALATED":
      return "border-red-600 bg-red-100 animate-pulse";
    case "WARNING":
      return "border-yellow-500 bg-yellow-100";
    case "NORMAL":
    case "RESOLVED":
    default:
      return "border-slate-200 bg-white";
  }
}

function getEscalationLabel(level: ReturnType<typeof getEscalationLevel>): string | null {
  if (level === "CRITICAL_ESCALATED") {
    return "🔥 Escalated";
  }

  if (level === "WARNING") {
    return "Delayed";
  }

  return null;
}

function formatUnresolvedDuration(value: string | null, resolved: boolean): string | null {
  if (resolved || !value) {
    return null;
  }

  const createdAt = Date.parse(value);
  if (Number.isNaN(createdAt)) {
    return null;
  }

  const diffMs = Math.max(Date.now() - createdAt, 0);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m unresolved`;
  }

  return `${hours}h ${minutes}m unresolved`;
}

export default function AlertsDashboardPage() {
  const [alerts, setAlerts] = useState<AutomationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>("ALL");
  const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>("ALL");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAlerts(showSkeleton = false) {
      try {
        if (showSkeleton) {
          setLoading(true);
        }

        setError(null);
        const response = await authFetch("/api/automation-alerts");
        const payload = (await response.json()) as AutomationAlert[];

        if (cancelled) {
          return;
        }

        setAlerts(Array.isArray(payload) ? payload : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.error("Failed to fetch alerts:", loadError);
        setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchAlerts(true);

    const intervalId = window.setInterval(() => {
      void fetchAlerts(false);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesType = typeFilter === "ALL" || alert.type === typeFilter;
      const matchesResolution =
        resolutionFilter === "ALL" ||
        (resolutionFilter === "ACTIVE" && !alert.resolved) ||
        (resolutionFilter === "RESOLVED" && alert.resolved);

      return matchesType && matchesResolution;
    }).sort((left, right) => {
      const leftEscalation = getEscalationLevel(left.createdAt ?? new Date(0), left.resolved);
      const rightEscalation = getEscalationLevel(right.createdAt ?? new Date(0), right.resolved);
      const escalationDelta = getEscalationOrder(leftEscalation) - getEscalationOrder(rightEscalation);

      if (escalationDelta !== 0) {
        return escalationDelta;
      }

      const typeDelta = getAlertTypeOrder(left.type) - getAlertTypeOrder(right.type);
      if (typeDelta !== 0) {
        return typeDelta;
      }

      const leftCreated = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightCreated = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightCreated - leftCreated;
    });
  }, [alerts, resolutionFilter, typeFilter]);

  const activeAlerts = useMemo(
    () => filteredAlerts.filter((alert) => !alert.resolved),
    [filteredAlerts]
  );

  const resolvedAlerts = useMemo(
    () => filteredAlerts.filter((alert) => alert.resolved),
    [filteredAlerts]
  );

  async function markAsResolved(alertId: string) {
    try {
      setResolvingId(alertId);

      const response = await authFetch("/api/automation-alerts", {
        method: "PATCH",
        body: JSON.stringify({ alertId }),
      });
      const payload = (await response.json()) as { alert?: AutomationAlert };

      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId && payload.alert ? payload.alert : alert
        )
      );
    } catch (resolveError) {
      console.error("Failed to resolve alert:", resolveError);
      setError(getErrorMessage(resolveError));
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading system alerts...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-rose-900">Alerts unavailable</h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                System Alerts
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                System Alerts
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Live automation events
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              Auto-refresh 5s
            </span>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["ALL", "CRITICAL", "WARNING", "ERROR"] as AlertTypeFilter[]).map((type) => {
                const active = typeFilter === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-sky-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["ALL", "ACTIVE", "RESOLVED"] as ResolutionFilter[]).map((status) => {
                const active = resolutionFilter === status;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setResolutionFilter(status)}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {status === "ALL" ? "All" : status === "ACTIVE" ? "Active" : "Resolved"}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Active Alerts</h2>
            <span className="text-sm text-slate-500">{activeAlerts.length} active</span>
          </div>

          {activeAlerts.length === 0 ? (
            <Card className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No active alerts found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeAlerts.map((alert) => (
                (() => {
                  const escalation = getEscalationLevel(alert.createdAt ?? new Date(0), alert.resolved);
                  const escalationLabel = getEscalationLabel(escalation);
                  const unresolvedDuration = formatUnresolvedDuration(alert.createdAt, alert.resolved);

                  return (
                <Card
                  key={alert.id}
                  className={`rounded-3xl border p-5 shadow-sm ${getEscalationCardClasses(escalation)}`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className={`text-base text-slate-900 ${escalation === "CRITICAL_ESCALATED" ? "font-bold" : "font-semibold"}`}>
                          {alert.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getTypeClasses(alert.type)}`}>
                            {alert.type}
                          </span>
                          <Badge tone={getTypeBadgeTone(alert.type)}>Active</Badge>
                          {escalationLabel ? (
                            <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {escalationLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created</dt>
                        <dd className="mt-1 font-medium text-slate-800">{formatDate(alert.createdAt)}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contractor ID</dt>
                        <dd className="mt-1 font-medium text-slate-800">{alert.contractorId || "-"}</dd>
                      </div>
                      {unresolvedDuration ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:col-span-2">
                          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Timer</dt>
                          <dd className="mt-1 font-medium text-slate-800">{unresolvedDuration}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void markAsResolved(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resolvingId === alert.id ? "Resolving..." : "Mark as Resolved"}
                      </button>
                    </div>
                  </div>
                </Card>
                  );
                })()
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Resolved Alerts</h2>
            <span className="text-sm text-slate-500">{resolvedAlerts.length} resolved</span>
          </div>

          {resolvedAlerts.length === 0 ? (
            <Card className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No resolved alerts found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {resolvedAlerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`rounded-3xl border p-5 shadow-sm ${getEscalationCardClasses(getEscalationLevel(alert.createdAt ?? new Date(0), alert.resolved))}`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-slate-900">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getTypeClasses(alert.type)}`}>
                            {alert.type}
                          </span>
                          <Badge tone="neutral">Resolved</Badge>
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created</dt>
                        <dd className="mt-1 font-medium text-slate-800">{formatDate(alert.createdAt)}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contractor ID</dt>
                        <dd className="mt-1 font-medium text-slate-800">{alert.contractorId || "-"}</dd>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resolved At</dt>
                        <dd className="mt-1 font-medium text-slate-800">{formatDate(alert.resolvedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

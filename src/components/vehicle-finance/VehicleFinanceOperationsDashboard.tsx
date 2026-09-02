"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";

type OperationsResponse = {
  metrics: {
    todayApplications: number;
    awaitingAssignment: number;
    awaitingDocuments: number;
    awaitingBank: number;
    approvalsToday: number;
    declines: number;
    averageApprovalTimeHours: number;
    averageDealTimeHours: number;
    overdueTasks: number;
    workflowBottlenecks: Array<{ stage: string; count: number }>;
    consultantPerformance: Array<{ consultant: string; applications: number; approved: number; overdue: number }>;
    unreadNotifications: number;
  };
  taskSummary: {
    totalCount: number;
    openCount: number;
    inProgressCount: number;
    doneCount: number;
    blockedCount: number;
    overdueCount: number;
  };
  overview: {
    applications: Array<{
      applicationId: string;
      customerId: string;
      dealerName: string;
      vehicleTitle?: string | null;
      workflowStageId?: string | null;
      workflowStageLabel?: string | null;
      workflowNextRequiredAction?: string | null;
      workflowProgressPercentage?: number | null;
      updatedAt: string;
      createdAt: string;
      assignedConsultantName?: string | null;
    }>;
    customers: Array<{ customerId: string; firstName: string; lastName: string; phone: string; email: string }>;
  };
  unreadNotifications: number;
  generatedAt: string;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    applicationId: string | null;
    unread: boolean;
    channel: string;
    priority: string;
    createdAt: string;
  }>;
};

type SearchResponse = {
  query: string;
  count: number;
  results: Array<{
    applicationId: string;
    customerId: string;
    dealerName: string;
    workflowStageLabel?: string | null;
    workflowNextRequiredAction?: string | null;
    workflowProgressPercentage?: number | null;
    updatedAt: string;
  }>;
};

function formatDate(value?: string | null): string {
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

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0h";
  return `${value}h`;
}

export default function VehicleFinanceOperationsDashboard() {
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationResponse | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  async function loadOperations() {
    const [operationsResponse, notificationsResponse] = await Promise.all([
      authFetch("/api/vehicle-finance/operations", { cache: "no-store" }),
      authFetch("/api/vehicle-finance/notifications?unreadOnly=0", { cache: "no-store" }),
    ]);

    if (!operationsResponse.ok) {
      throw new Error(`Operations request failed (${operationsResponse.status})`);
    }

    if (!notificationsResponse.ok) {
      throw new Error(`Notifications request failed (${notificationsResponse.status})`);
    }

    const [operationsPayload, notificationsPayload] = await Promise.all([
      operationsResponse.json() as Promise<OperationsResponse>,
      notificationsResponse.json() as Promise<NotificationResponse>,
    ]);
    setOperations(operationsPayload);
    setNotifications(notificationsPayload);
  }

  useEffect(() => {
    const controller = new AbortController();
    loadOperations()
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Torque Empire Car Division operations unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const metrics = operations?.metrics;
  const applications = operations?.overview.applications ?? [];
  const customers = useMemo(() => new Map((operations?.overview.customers ?? []).map((customer) => [customer.customerId, customer])), [operations?.overview.customers]);
  const topApplications = applications.slice(0, 8);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    setSubmittedQuery(normalizedQuery);
    if (!normalizedQuery) {
      setSearchResults(null);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await authFetch(`/api/vehicle-finance/search?q=${encodeURIComponent(normalizedQuery)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Search request failed (${response.status})`);
      }
      setSearchResults((await response.json()) as SearchResponse);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Vehicle finance search unavailable");
    } finally {
      setSearchLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    const response = await authFetch("/api/vehicle-finance/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (!response.ok) {
      throw new Error(`Unable to mark notifications as read (${response.status})`);
    }
    await loadOperations();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="rounded-[28px] border border-sky-300/15 bg-slate-950/90 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/80">Torque Empire Car Division Operations Centre</p>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">Dealer operations control room.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Track consultant workload, workflow bottlenecks, unresolved tasks, notifications, and the next action required on every finance application.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex w-full max-w-xl gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search applications, customers, vehicles, consultants"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500"
            />
            <button type="submit" className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950">
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>
      </section>

      {loading ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-slate-300">Loading operations...</div> : null}
      {error ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Today", metrics?.todayApplications ?? 0, "Applications created today"],
          ["Assignments", metrics?.awaitingAssignment ?? 0, "Awaiting consultant assignment"],
          ["Documents", metrics?.awaitingDocuments ?? 0, "Awaiting supporting documents"],
          ["Banking", metrics?.awaitingBank ?? 0, "Awaiting bank movement"],
          ["Approvals", metrics?.approvalsToday ?? 0, "Approvals recorded today"],
          ["Declines", metrics?.declines ?? 0, "Declines recorded"],
          ["Overdue Tasks", metrics?.overdueTasks ?? 0, "Operational tasks past due"],
          ["Unread", notifications?.unreadCount ?? metrics?.unreadNotifications ?? 0, "Unread notifications"],
        ].map(([label, value, subtitle]) => (
          <Card key={label as string} className="min-h-[146px] border-sky-300/10 bg-slate-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/70">{label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value as number}</p>
            <p className="mt-2 text-sm text-slate-400">{subtitle as string}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <IdentityCardHeader title="Applications" subtitle="Current workflow, owner, next required action, and progress." />
          <Table className="mt-4 table-fixed">
            <thead>
              <tr>
                <th className="w-[18%]">Application</th>
                <th className="w-[22%]">Customer</th>
                <th className="w-[18%]">Consultant</th>
                <th className="w-[20%]">Next Action</th>
                <th className="w-[12%]">Progress</th>
                <th className="w-[10%]">Updated</th>
              </tr>
            </thead>
            <tbody>
              {topApplications.map((application) => {
                const customer = customers.get(application.customerId);
                return (
                  <tr key={application.applicationId}>
                    <td>
                      <div className="space-y-1">
                        <Link href={`/dashboard/vehicle-finance/applications/${encodeURIComponent(application.applicationId)}`} className="font-semibold text-sky-200 no-underline">
                          {application.applicationId}
                        </Link>
                        <p className="text-xs text-slate-500">{application.dealerName}</p>
                      </div>
                    </td>
                    <td>
                      <p className="font-medium text-slate-100">{customer ? `${customer.firstName} ${customer.lastName}` : application.customerId}</p>
                      <p className="text-xs text-slate-500">{application.workflowStageLabel ?? "New Application"}</p>
                    </td>
                    <td className="text-sm text-slate-300">{application.assignedConsultantName ?? "Unassigned"}</td>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-100">{application.workflowNextRequiredAction ?? "Awaiting workflow sync"}</p>
                        <Badge tone={(application.workflowProgressPercentage ?? 0) >= 100 ? "completed" : "inProgress"}>{application.workflowProgressPercentage ?? 0}%</Badge>
                      </div>
                    </td>
                    <td className="text-sm text-slate-300">{application.workflowProgressPercentage ?? 0}%</td>
                    <td className="text-sm text-slate-400">{formatDate(application.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {submittedQuery && searchResults ? (
            <div className="mt-6 rounded-2xl border border-sky-300/15 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/70">Search results</p>
                  <p className="mt-1 text-sm text-slate-300">{searchResults.count} result(s) for “{searchResults.query}”</p>
                </div>
                <Badge tone={searchResults.count > 0 ? "success" : "notStarted"}>{searchResults.count}</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                {searchResults.results.slice(0, 6).map((result) => (
                  <Link
                    key={result.applicationId}
                    href={`/dashboard/vehicle-finance/applications/${encodeURIComponent(result.applicationId)}`}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 no-underline transition hover:border-sky-300/20 hover:bg-sky-300/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{result.applicationId}</p>
                        <p className="mt-1 text-sm text-slate-400">{result.dealerName}</p>
                      </div>
                      <Badge tone="info">{result.workflowProgressPercentage ?? 0}%</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{result.workflowNextRequiredAction ?? "Awaiting action"}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <IdentityCardHeader title="Notifications" subtitle="Unread operational alerts and workflow changes." />
            <div className="mt-4 flex items-center justify-between gap-3">
              <Badge tone={notifications?.unreadCount ? "warning" : "notStarted"}>{notifications?.unreadCount ?? 0} unread</Badge>
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white"
              >
                Mark all read
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {(notifications?.notifications ?? []).slice(0, 5).map((notification) => (
                <div key={notification.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{notification.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{notification.message}</p>
                    </div>
                    <Badge tone={notification.unread ? "warning" : "completed"}>{notification.unread ? "Unread" : "Read"}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{formatDate(notification.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <IdentityCardHeader title="Task Summary" subtitle="Operational workload and bottlenecks." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Total", metrics?.overdueTasks ?? 0, "Overdue"],
                ["Open", operations?.taskSummary.openCount ?? 0, "Open tasks"],
                ["Progress", operations?.taskSummary.inProgressCount ?? 0, "In progress"],
                ["Done", operations?.taskSummary.doneCount ?? 0, "Completed"],
              ].map(([label, value, subtitle]) => (
                <div key={label as string} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{value as number}</p>
                  <p className="mt-1 text-xs text-slate-400">{subtitle as string}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <IdentityCardHeader title="Workflow Bottlenecks" subtitle="Stages with the highest concentration of active files." />
            <div className="mt-4 space-y-3">
              {(metrics?.workflowBottlenecks ?? []).map((item) => (
                <div key={item.stage} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <span className="text-sm font-medium text-slate-100">{item.stage}</span>
                  <Badge tone="warning">{item.count}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <IdentityCardHeader title="Consultant Performance" subtitle="Assignment visibility for managers and principals." />
          <Table className="mt-4">
            <thead>
              <tr>
                <th>Consultant</th>
                <th>Applications</th>
                <th>Approved</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.consultantPerformance ?? []).slice(0, 8).map((row) => (
                <tr key={row.consultant}>
                  <td>{row.consultant}</td>
                  <td>{row.applications}</td>
                  <td>{row.approved}</td>
                  <td>{row.overdue}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <IdentityCardHeader title="Operational Times" subtitle="Average throughput across the dealership workflow." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Average Approval Time", formatHours(metrics?.averageApprovalTimeHours ?? 0)],
              ["Average Deal Time", formatHours(metrics?.averageDealTimeHours ?? 0)],
              ["Unread Notifications", String(notifications?.unreadCount ?? 0)],
              ["Generated At", formatDate(operations?.generatedAt)],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-3 text-xl font-semibold text-white">{value as string}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

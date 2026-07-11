"use client";

import { useEffect, useState } from "react";
import ContractorOnboardingView from "@/components/contractors/ContractorOnboardingView";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";
import {
  ActionButton,
  DashboardCard,
  DashboardShell,
  InsightPanel,
  MetricCard,
  ModuleHeader,
  StatusBadge,
} from "@/components/tex/ExecutivePrimitives";
import DealChart from "./DealChart";
import KpiCard from "./KpiCard";

type Summary = {
  totalDeals: number;
  readyDeals: number;
  submitted: number;
  blockedDeals: number;
  riskDeals: number;
  avgReadiness: number;
  recent: {
    id: string;
    text: string;
    status?: string;
    updatedAt?: string | null;
  }[];
};

function formatUpdatedAt(value?: string | null): string {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


function getStatusTone(status?: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "READY") return "success";
  if (status === "RISK") return "warning";
  if (status === "BLOCKED") return "danger";
  return "neutral";
}

export default function DashboardHome() {
  const { loading: authLoading, role, contractorId } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || role === "contractor" || isVehicleFinanceRole(role)) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 6000);

    authFetch(API_ROUTES.DASHBOARD_SUMMARY, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load dashboard summary");
        }

        return response.json() as Promise<Summary>;
      })
      .then((summary) => {
        setData(summary);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name !== "AbortError") {
          console.error("[DashboardHome] Summary fetch failed", fetchError);
        }

        setData(null);
        setError(
          fetchError instanceof Error && fetchError.name === "AbortError"
            ? "Dashboard summary took too long to load."
            : "Dashboard summary is temporarily unavailable."
        );
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [authLoading, role]);

  useEffect(() => {
    if (!authLoading && isVehicleFinanceRole(role)) {
      setRedirecting(true);
      window.location.replace("/dashboard/vehicle-finance");
    }
  }, [authLoading, role]);

  if (authLoading) {
    return (
      <DashboardCard>
        <p className="text-sm font-medium">Loading dashboard...</p>
      </DashboardCard>
    );
  }

  if (role === "contractor") {
    return contractorId ? (
      <ContractorOnboardingView contractorId={contractorId} />
    ) : (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Contractor profile is still syncing. Refresh shortly if this remains visible.
      </div>
    );
  }

  if (redirecting || isVehicleFinanceRole(role)) {
    return (
      <DashboardCard>
        <p className="text-sm font-medium">Opening Vehicle Finance command center...</p>
      </DashboardCard>
    );
  }

  if (loading) {
    return (
      <DashboardCard>
        <p className="dashboard-eyebrow">Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">
          Preparing executive summary
        </h2>
        <p className="tex-copy mt-3 text-sm">
          Loading dashboard summary...
        </p>
      </DashboardCard>
    );
  }

  if (!data) {
    return (
      <DashboardCard className="border-[color:var(--tex-danger)]">
        <p className="dashboard-eyebrow">Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">
          Dashboard available
        </h2>
        <p className="tex-copy mt-2 text-sm">
          {error ?? "No data available."}
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardShell module="dashboard" focus className="space-y-6 md:space-y-8">
      <DashboardCard className="px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="tex-metric-label">
              System Status
            </p>
            <p className="mt-2 text-sm font-medium text-[color:var(--tex-text-strong)] sm:text-base">
              All systems operational - contractors actively progressing
            </p>
          </div>
          <StatusBadge tone="success" className="self-start uppercase tracking-[0.16em]">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--tex-success)]" />
            Live
          </StatusBadge>
        </div>
      </DashboardCard>

      <ModuleHeader
        eyebrow="Enterprise Overview"
        title="Torque Empire AI Procurement Intelligence"
        description="Real-time contractor readiness and tender performance insights."
        actions={<ActionButton href="/dashboard/vehicle-finance">Open Vehicle Finance Command Center</ActionButton>}
      >
          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
            <MetricCard label="Ready Ratio" value={data.totalDeals > 0 ? `${Math.round((data.readyDeals / data.totalDeals) * 100)}%` : "0%"} />
            <MetricCard label="Submission Rate" value={data.totalDeals > 0 ? `${Math.round((data.submitted / data.totalDeals) * 100)}%` : "0%"} />
            <MetricCard label="Risk Watch" value={data.riskDeals + data.blockedDeals} />
          </div>
      </ModuleHeader>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <KpiCard
          title="Total Deals"
          value={data.totalDeals}
          description="Active tenders being processed across the current portfolio."
          trend="+12% this week"
        />
        <KpiCard
          title="Ready Deals"
          value={data.readyDeals}
          description="Ready for submission pipeline with minimal friction remaining."
          trend="Stable growth"
        />
        <KpiCard
          title="Submitted"
          value={data.submitted}
          description="Tenders already advanced into formal submission execution."
          trend="Consistent flow"
        />
        <KpiCard
          title="Avg Readiness"
          value={`${data.avgReadiness}%`}
          description="Overall contractor performance and tender preparedness score."
          trend={data.avgReadiness >= 70 ? "Strong operating posture" : "Needs intervention"}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <DealChart
          data={[
            { name: "Ready", value: data.readyDeals },
            { name: "Blocked", value: data.blockedDeals },
            { name: "Risk", value: data.riskDeals },
          ]}
        />

        <DashboardCard className="p-6 md:p-7">
          <p className="dashboard-eyebrow">At A Glance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">
            Portfolio Signals
          </h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[18px] border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[color:var(--tex-text)]">Ready to submit</span>
                <StatusBadge tone="success">Healthy</StatusBadge>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--tex-text-strong)]">
                {data.readyDeals}
              </p>
            </div>

            <div className="rounded-[18px] border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[color:var(--tex-text)]">Blocked pipeline</span>
                <StatusBadge tone="danger">Attention</StatusBadge>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--tex-text-strong)]">
                {data.blockedDeals}
              </p>
            </div>

            <div className="rounded-[18px] border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[color:var(--tex-text)]">Risk concentration</span>
                <StatusBadge tone="warning">Monitor</StatusBadge>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--tex-text-strong)]">
                {data.riskDeals}
              </p>
            </div>
          </div>
        </DashboardCard>
      </section>

      <DashboardCard className="p-6 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="dashboard-eyebrow">Recent Activity</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">
              Recent Tender Activity
            </h2>
            <p className="tex-copy mt-2 text-sm">
              Live contractor engagement and submission readiness
            </p>
          </div>
          <p className="tex-copy text-sm">
            Latest readiness and submission movement across tracked deals.
          </p>
        </div>

        <div className="tex-table-wrap mt-6">
          <table className="tex-table min-w-[640px]">
            <thead>
              <tr>
                <th className="pb-4 font-medium">Deal</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Activity</th>
                <th className="pb-4 font-medium">Updated</th>
              </tr>
            </thead>

            <tbody>
              {data.recent.map((deal) => (
                <tr
                  key={deal.id}
                >
                  <td className="py-4 pr-4">
                    <div className="font-medium text-[color:var(--tex-text-strong)]">{deal.id}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--tex-text-muted)]">
                      Tender record
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge tone={getStatusTone(deal.status)}>
                      {deal.status ?? "LIVE"}
                    </StatusBadge>
                  </td>
                  <td className="py-4 pr-4 text-[color:var(--tex-text)]">{deal.text}</td>
                  <td className="py-4 text-[color:var(--tex-text-muted)]">{formatUpdatedAt(deal.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <InsightPanel title="Executive Insight">
        <p className="text-sm leading-7">
          Insight:{" "}
          <span className="font-semibold text-[color:var(--tex-text-strong)]">
            {data.totalDeals > 0 ? `${Math.round((data.readyDeals / data.totalDeals) * 100)}%` : "0%"}
          </span>{" "}
          of active tenders are submission-ready, while{" "}
          <span className="font-semibold text-[color:var(--tex-text-strong)]">
            {data.totalDeals > 0 ? `${Math.round((data.blockedDeals / data.totalDeals) * 100)}%` : "0%"}
          </span>{" "}
          require compliance intervention.
        </p>
      </InsightPanel>
    </DashboardShell>
  );
}

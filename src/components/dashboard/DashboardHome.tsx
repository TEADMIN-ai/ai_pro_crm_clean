"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ContractorOnboardingView from "@/components/contractors/ContractorOnboardingView";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";
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

function getStatusBadgeClasses(status?: string): string {
  if (status === "READY") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "RISK") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  }

  if (status === "BLOCKED") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-300";
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
      <div className="dashboard-panel rounded-[28px] p-6 text-slate-300">
        <p className="text-sm font-medium">Loading dashboard...</p>
      </div>
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
      <div className="dashboard-panel rounded-[28px] p-6 text-slate-300">
        <p className="text-sm font-medium">Opening Vehicle Finance command center...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-panel rounded-[28px] p-6 text-slate-300">
        <p className="dashboard-eyebrow">Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
          Preparing executive summary
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Loading dashboard summary...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-panel rounded-[28px] border-rose-500/20 p-6 text-slate-200">
        <p className="dashboard-eyebrow">Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
          Dashboard available
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {error ?? "No data available."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
      <section className="dashboard-panel rounded-[24px] bg-[linear-gradient(90deg,rgba(8,15,30,0.96),rgba(15,23,42,0.92))] px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              System Status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-100 sm:text-base">
              All systems operational - contractors actively progressing
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-emerald-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.65)]" />
            Live
          </div>
        </div>
      </section>

      <section className="dashboard-panel overflow-hidden rounded-[32px] p-6 md:p-8">
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="dashboard-eyebrow">Enterprise Overview</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-5xl">
              Torque Empire AI Procurement Intelligence
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Real-time contractor readiness and tender performance insights
            </p>
            <Link
              href="/dashboard/vehicle-finance"
              className="mt-5 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 no-underline transition hover:bg-cyan-400/16"
            >
              Open Vehicle Finance Command Center
            </Link>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Ready Ratio
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                {data.totalDeals > 0 ? `${Math.round((data.readyDeals / data.totalDeals) * 100)}%` : "0%"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Submission Rate
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                {data.totalDeals > 0 ? `${Math.round((data.submitted / data.totalDeals) * 100)}%` : "0%"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Risk Watch
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                {data.riskDeals + data.blockedDeals}
              </p>
            </div>
          </div>
        </div>
      </section>

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

        <div className="dashboard-panel rounded-[28px] p-6 md:p-7">
          <p className="dashboard-eyebrow">At A Glance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Portfolio Signals
          </h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-300">Ready to submit</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Healthy
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                {data.readyDeals}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-300">Blocked pipeline</span>
                <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100">
                  Attention
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                {data.blockedDeals}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-300">Risk concentration</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
                  Monitor
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                {data.riskDeals}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-panel rounded-[28px] p-6 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="dashboard-eyebrow">Recent Activity</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              Recent Tender Activity
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Live contractor engagement and submission readiness
            </p>
          </div>
          <p className="text-sm text-slate-400">
            Latest readiness and submission movement across tracked deals.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm text-white">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.22em] text-slate-500">
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
                  className="border-t border-white/8 transition duration-200 hover:bg-white/[0.05]"
                >
                  <td className="py-4 pr-4">
                    <div className="font-medium text-white">{deal.id}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Tender record
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClasses(deal.status)}`}>
                      {deal.status ?? "LIVE"}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-slate-300">{deal.text}</td>
                  <td className="py-4 text-slate-400">{formatUpdatedAt(deal.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel rounded-[28px] p-6 md:p-7">
        <p className="dashboard-eyebrow">Executive Insight</p>
        <div className="mt-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-5 py-4">
          <p className="text-sm leading-7 text-slate-300">
            Insight:{" "}
            <span className="text-white">
              {data.totalDeals > 0 ? `${Math.round((data.readyDeals / data.totalDeals) * 100)}%` : "0%"}
            </span>{" "}
            of active tenders are submission-ready, while{" "}
            <span className="text-white">
              {data.totalDeals > 0 ? `${Math.round((data.blockedDeals / data.totalDeals) * 100)}%` : "0%"}
            </span>{" "}
            require compliance intervention.
          </p>
        </div>
      </section>
    </div>
  );
}

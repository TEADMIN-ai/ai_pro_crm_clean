"use client";

import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";

export default function InsightsPanel() {
  const { data, loading, error } = useEnterpriseKpis();

  return (
    <div className="space-y-3 rounded-xl bg-[#111827] p-4">
      <h2 className="text-lg font-semibold text-white">System Insights</h2>

      {loading ? (
        <p className="text-sm text-slate-400">Loading enterprise KPIs...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            You have <span className="font-medium text-white">{data?.dashboardSummary.totalOpportunities ?? 0}</span> total opportunities.
          </p>

          <p className="text-sm text-slate-400">
            <span className="font-medium text-green-400">{data?.dashboardSummary.readyForSubmission ?? 0}</span> opportunities are ready for submission.
          </p>

          <p className="text-sm text-slate-400">
            Readiness rate: <span className="font-medium text-blue-400">{data?.readiness.averageScore ?? 0}%</span>
          </p>

          <p className="text-sm text-slate-400">
            Submitted: <span className="font-medium text-white">{data?.dashboardSummary.submitted ?? 0}</span>
          </p>
        </>
      )}
    </div>
  );
}

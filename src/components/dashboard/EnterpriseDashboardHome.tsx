"use client";

import { useEffect, useState } from "react";
import TeosOperationsHubHero from "@/components/dashboard/TeosOperationsHubHero";
import AdminDashboardHome from "@/components/dashboard/AdminDashboardHome";
import EnterpriseManagerDashboard from "@/components/dashboard/EnterpriseManagerDashboard";
import StaffDashboardHome from "@/components/dashboard/StaffDashboardHome";
import { useAuth } from "@/context/AuthContext";
import { isVehicleFinanceRole } from "@/lib/auth/roleUtils";
import RequireRole from "@/components/auth/RequireRole";
import ContractorOnboardingView from "@/components/contractors/ContractorOnboardingView";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import { DashboardCard, DashboardShell, InsightPanel, StatusBadge } from "@/components/tex/ExecutivePrimitives";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";

function formatUpdatedAt(value?: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function getStatusTone(status?: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "ready_for_submission") return "success";
  if (status === "submitted") return "success";
  if (status === "blocked") return "danger";
  if (status === "risk") return "warning";
  return "neutral";
}

export default function EnterpriseDashboardHome() {
  const { loading: authLoading, role, contractorId } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const { data, loading, error } = useEnterpriseKpis({
    enabled: !authLoading && role !== "admin" && role !== "manager" && role !== "staff" && role !== "contractor" && !isVehicleFinanceRole(role),
  });

  useEffect(() => {
    if (!authLoading && isVehicleFinanceRole(role)) {
      setRedirecting(true);
      window.location.replace("/dashboard/vehicle-finance");
    }
  }, [authLoading, role]);

  if (authLoading) {
    return <DashboardCard><p className="text-sm font-medium">Loading dashboard...</p></DashboardCard>;
  }

  if (role === "contractor") {
    return contractorId ? <ContractorOnboardingView contractorId={contractorId} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Contractor profile is still syncing. Refresh shortly if this remains visible.</div>;
  }

  if (redirecting || isVehicleFinanceRole(role)) {
    return <DashboardCard><p className="text-sm font-medium">Opening Vehicle Finance command center...</p></DashboardCard>;
  }

  if (role === "admin") {
    return <AdminDashboardHome />;
  }

  if (role === "manager") {
    return <EnterpriseManagerDashboard />;
  }

  if (role === "staff") {
    return <StaffDashboardHome />;
  }

  if (loading) {
    return <DashboardCard><p className="dashboard-eyebrow">Dashboard</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">Preparing enterprise summary</h2><p className="tex-copy mt-3 text-sm">Loading live enterprise KPI snapshot...</p></DashboardCard>;
  }

  if (error || !data) {
    return <DashboardCard className="border-[color:var(--tex-danger)]"><p className="dashboard-eyebrow">Dashboard</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)]">Dashboard available</h2><p className="tex-copy mt-2 text-sm">{error ?? "No data available."}</p></DashboardCard>;
  }

  const summary = data.dashboardSummary;
  const total = summary.totalOpportunities;
  const hasProductionRecords = total > 0 || data.contractors.total > 0 || data.submissions.total > 0;
  const readinessScore = `${data.readiness.averageScore}%`;
  const submissionRate = `${data.submissions.conversionRate}%`;

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <DashboardShell module="dashboard" focus className="space-y-6 md:space-y-8">
        <DashboardCard className="px-5 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="tex-metric-label">System Status</p>
              <p className="mt-2 text-sm font-medium text-[color:var(--tex-text-strong)] sm:text-base">
                {hasProductionRecords ? "Live enterprise KPI service connected." : "Live enterprise KPI service connected; no production records found."}
              </p>
            </div>
            <StatusBadge tone={hasProductionRecords ? "success" : "neutral"} className="self-start uppercase tracking-[0.16em]"><span className="h-2.5 w-2.5 rounded-full bg-[color:var(--tex-success)]" />Live</StatusBadge>
          </div>
        </DashboardCard>

        <TeosOperationsHubHero data={data} readinessScore={readinessScore} submissionRate={submissionRate} />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          <Card><p className="enterprise-metric-label">Total Opportunities</p><h2 className="enterprise-metric-value">{total}</h2></Card>
          <Card><p className="enterprise-metric-label">Ready For Submission</p><h2 className="enterprise-metric-value">{summary.readyForSubmission}</h2></Card>
          <Card><p className="enterprise-metric-label">Pipeline Value</p><h2 className="enterprise-metric-value">ZAR {data.revenue.pipelineValue.toLocaleString("en-ZA")}</h2></Card>
          <Card><p className="enterprise-metric-label">Avg Readiness</p><h2 className="enterprise-metric-value">{summary.avgReadiness}%</h2></Card>
        </section>

        <Card><h2>Portfolio Signals</h2><div className="compliance-summary"><div className="compliance-summary-item"><p className="enterprise-metric-label">Submitted</p><p className="enterprise-metric-value">{summary.submitted}</p></div><div className="compliance-summary-item"><p className="enterprise-metric-label">Blocked</p><p className="enterprise-metric-value">{summary.blocked}</p></div><div className="compliance-summary-item"><p className="enterprise-metric-label">Risk</p><p className="enterprise-metric-value">{summary.risk}</p></div><div className="compliance-summary-item"><p className="enterprise-metric-label">Unassigned</p><p className="enterprise-metric-value">{data.opportunities.unassigned}</p></div></div></Card>

        <Card>
          <IdentityCardHeader title="Recent Activity" subtitle="Latest live opportunity movement">
            <Badge tone="info">{summary.recent.length} Items</Badge>
          </IdentityCardHeader>
          {summary.recent.length === 0 ? <div>No opportunities found.</div> : (
            <Table><thead><tr><th>Opportunity</th><th>Status</th><th>Activity</th><th>Updated</th></tr></thead><tbody>{summary.recent.map((item) => (<tr key={item.id}><td>{item.title}</td><td><Badge tone={getStatusTone(item.status)}>{item.status}</Badge></td><td>{item.text}</td><td>{formatUpdatedAt(item.updatedAt)}</td></tr>))}</tbody></Table>
          )}
        </Card>

        <InsightPanel title="Executive Insight">
          <p className="text-sm leading-7">Insight: <span className="font-semibold text-[color:var(--tex-text-strong)]">{readinessScore}</span> of active opportunities are submission-ready, while <span className="font-semibold text-[color:var(--tex-text-strong)]">{summary.blocked}</span> require compliance intervention.</p>
        </InsightPanel>
      </DashboardShell>
    </RequireRole>
  );
}




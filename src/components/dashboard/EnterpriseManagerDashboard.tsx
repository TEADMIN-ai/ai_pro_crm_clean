"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HeroBanner from "@/components/hero/HeroBanner";
import { getHeroImage } from "@/config/heroRules";
import { useAuth } from "@/context/AuthContext";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import type { Deal } from "@/types/deal";
import RequireRole from "@/components/auth/RequireRole";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import RevenueKpiRow from "@/components/Kpi/RevenueKpiRow";
import { TeosOperationsHubHeroFromSnapshot } from "@/components/dashboard/TeosOperationsHubHero";

function getDealRiskTone(value: number): "success" | "warning" | "danger" {
  if (value >= 500000) return "danger";
  if (value >= 100000) return "warning";
  return "success";
}

export default function EnterpriseManagerDashboard() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const { data, loading, error } = useEnterpriseKpis();

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setDeals(await getDealsForUser(user));
      } catch (err) {
        console.error("Failed to load deals", err);
        setDeals([]);
      } finally {
        setLoadingDeals(false);
      }
    };

    void fetchDeals();
  }, [user]);

  const summary = data?.dashboardSummary;
  const totalOpportunities = summary?.totalOpportunities ?? 0;
  const unassigned = data?.opportunities.unassigned ?? 0;
  const heroImage = getHeroImage({ role: "manager", totalDeals: totalOpportunities, unassignedDeals: unassigned, isMonthEnd: new Date().getDate() >= 25 });

  return (
    <RequireRole allow={["admin", "manager"]}>
      <div className="enterprise-page enterprise-grid">
        {data ? <TeosOperationsHubHeroFromSnapshot data={data} /> : null}
        <Card><HeroBanner image={heroImage} title="Manager Dashboard" subtitle="Revenue, pipeline health, and execution velocity" /></Card>

        <Card>
          <IdentityCardHeader title="Manager Identity" subtitle="Live enterprise summary and contractor execution">
            <Badge tone="info">Total Opportunities {totalOpportunities}</Badge>
            <Badge tone={unassigned > 0 ? "warning" : "success"}>Unassigned {unassigned}</Badge>
          </IdentityCardHeader>
        </Card>

        <Card>
          <IdentityCardHeader title="Contractor Onboarding" subtitle="Create contractor users and onboarding invitations">
            <Link href="/dashboard/contractors" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline">Create Contractor User</Link>
          </IdentityCardHeader>
        </Card>

        <Card>
          <h2>Compliance Score Summary</h2>
          <div className="compliance-summary">
            <div className="compliance-summary-item"><p className="enterprise-metric-label">Total Opportunities</p><p className="enterprise-metric-value">{totalOpportunities}</p></div>
            <div className="compliance-summary-item"><p className="enterprise-metric-label">Ready To Submit</p><p className="enterprise-metric-value">{summary?.readyForSubmission ?? 0}</p></div>
            <div className="compliance-summary-item"><p className="enterprise-metric-label">Submission Rate</p><p className="enterprise-metric-value">{data?.submissions.conversionRate ?? 0}%</p></div>
            <div className="compliance-summary-item"><p className="enterprise-metric-label">Avg Readiness</p><p className="enterprise-metric-value">{summary?.avgReadiness ?? 0}%</p></div>
          </div>
        </Card>

        <Card>{loading ? <p>Loading live enterprise KPIs...</p> : error ? <p>{error}</p> : <RevenueKpiRow kpis={{ totalRevenue: data?.revenue.totalValue ?? 0, dealsCount: totalOpportunities, conversionRate: data?.submissions.conversionRate ?? 0 }} />}</Card>

        <Card>
          <HeroBanner image={heroImage} title="Pipeline Overview" subtitle="Recent deal movement" />
        </Card>

        <Card>
          <h2>Recent Deals</h2>
          {loadingDeals && <div>Loading deals...</div>}
          {!loadingDeals && deals.length === 0 && <div>No deals found.</div>}
          {!loadingDeals && deals.length > 0 && (
            <Table>
              <thead><tr><th>Deal</th><th>Stage</th><th>Value</th><th>Risk Indicator</th></tr></thead>
              <tbody>{deals.slice(0, 10).map((deal) => (<tr key={deal.id}><td>{deal.title || "Untitled deal"}</td><td><Badge tone="info">{deal.stage ?? "lead"}</Badge></td><td>ZAR {(deal.value ?? 0).toLocaleString("en-ZA")}</td><td><Badge tone={getDealRiskTone(deal.value ?? 0)}>{(deal.value ?? 0) >= 500000 ? "High" : (deal.value ?? 0) >= 100000 ? "Medium" : "Low"}</Badge></td></tr>))}</tbody>
            </Table>
          )}
        </Card>
      </div>
    </RequireRole>
  );
}

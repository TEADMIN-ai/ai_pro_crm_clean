"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HeroBanner from "@/components/hero/HeroBanner";
import PipelineChart from "@/components/charts/PipelineChart";
import RevenueKpiRow from "@/components/Kpi/RevenueKpiRow";
import { getHeroImage } from "@/config/heroRules";
import { useRevenueKpis } from "@/hooks/useRevenueKpis";
import type { Deal } from "@/types/deal";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import RequireRole from "@/components/auth/RequireRole";

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setDeals(await getDealsForUser(user));
      } catch (err) {
        console.error("Failed to load deals", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchDeals();
  }, [user]);

  const totalDeals = deals.length;
  const unassignedDeals = useMemo(
    () => deals.filter((d) => !d.assignedTo || String(d.assignedTo).trim() === "").length,
    [deals]
  );

  const heroImage = getHeroImage({
    role: "manager",
    totalDeals,
    unassignedDeals,
    isMonthEnd: new Date().getDate() >= 25,
  });

  const kpis = useRevenueKpis(deals);

  return (
    <RequireRole allow={["admin", "manager"]}>
      <div className="enterprise-page enterprise-grid">
        <Card>
          <HeroBanner image={heroImage} title="Manager Dashboard" subtitle="Revenue, pipeline health, and execution velocity" />
        </Card>

        <Card>
          <IdentityCardHeader title="Manager Identity" subtitle="Pipeline oversight and compliance gating">
            <Badge tone="info">Total Deals {totalDeals}</Badge>
            <Badge tone={unassignedDeals > 0 ? "warning" : "success"}>Unassigned {unassignedDeals}</Badge>
          </IdentityCardHeader>
        </Card>

        <Card>
          <IdentityCardHeader title="Contractor Onboarding" subtitle="Create contractor users and onboarding invitations">
            <Link href="/dashboard/contractors" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline">
              Create Contractor User
            </Link>
          </IdentityCardHeader>
        </Card>

        <Card>
          <h2>Compliance Score Summary</h2>
          <div className="compliance-summary">
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Total Deals</p>
              <p className="enterprise-metric-value">{totalDeals}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Unassigned</p>
              <p className="enterprise-metric-value">{unassignedDeals}</p>
            </div>
          </div>
        </Card>

        <Card>
          <RevenueKpiRow kpis={kpis} />
        </Card>

        <Card>
          <PipelineChart deals={deals} />
        </Card>

        <Card>
          <h2>Recent Deals</h2>
          {loading && <div>Loading deals...</div>}
          {!loading && deals.length === 0 && <div>No deals found.</div>}
          {!loading && deals.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Risk Indicator</th>
                </tr>
              </thead>
              <tbody>
                {deals.slice(0, 10).map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.title || "Untitled deal"}</td>
                    <td><Badge tone="info">{deal.stage ?? "lead"}</Badge></td>
                    <td>ZAR {(deal.value ?? 0).toLocaleString("en-ZA")}</td>
                    <td>
                      <Badge tone={(deal.value ?? 0) >= 500000 ? "danger" : (deal.value ?? 0) >= 100000 ? "warning" : "success"}>
                        {(deal.value ?? 0) >= 500000 ? "High" : (deal.value ?? 0) >= 100000 ? "Medium" : "Low"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </RequireRole>
  );
}

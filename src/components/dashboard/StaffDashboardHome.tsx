"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import HeroBanner from "@/components/hero/HeroBanner";
import { getHeroImage } from "@/config/heroRules";
import type { Deal } from "@/types/deal";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import RequireRole from "@/components/auth/RequireRole";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import { TeosOperationsHubHeroFromSnapshot } from "@/components/dashboard/TeosOperationsHubHero";

function getDealRiskTone(value: number): "success" | "warning" | "danger" {
  if (value >= 500000) return "danger";
  if (value >= 100000) return "warning";
  return "success";
}

export default function StaffDashboardHome() {
  const { user, role, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const { data, loading: kpiLoading, error: kpiError } = useEnterpriseKpis();

  useEffect(() => {
    async function fetchDeals() {
      try {
        setDeals(await getDealsForUser(user));
      } catch (err) {
        console.error("Failed to load staff deals", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchDeals();
  }, [user]);

  if (authLoading) {
    return <div className="enterprise-page">Loading dashboard...</div>;
  }

  const heroRole = role === "admin" ? "manager" : role === "staff" ? "staff" : "manager";
  const heroImage = getHeroImage({ role: heroRole });

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <div className="enterprise-page enterprise-grid">
        {data ? <TeosOperationsHubHeroFromSnapshot data={data} /> : null}
        <Card>
          <HeroBanner image={heroImage} title="Staff Dashboard" subtitle="Operationally visible deals and execution queue" />
        </Card>

        <Card>
          <IdentityCardHeader title="Identity" subtitle={user?.email ?? "Signed in staff user"}>
            <Badge tone="info">Role {heroRole}</Badge>
            <Badge tone={(data?.opportunities.total ?? 0) > 0 ? "success" : "warning"}>Opportunities {data?.opportunities.total ?? 0}</Badge>
          </IdentityCardHeader>
        </Card>

        {(kpiLoading || kpiError) && (
          <Card>
            <p className="text-sm text-slate-600">{kpiLoading ? "Loading live enterprise KPIs..." : kpiError}</p>
          </Card>
        )}

        <Card>
          <h2>Compliance Score Summary</h2>
          <div className="compliance-summary">
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Opportunities</p>
              <p className="enterprise-metric-value">{data?.opportunities.total ?? 0}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Pipeline Value</p>
              <p className="enterprise-metric-value">ZAR {(data?.revenue.pipelineValue ?? 0).toLocaleString("en-ZA")}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2>Recent Deal Table</h2>
          {loading && <div>Loading deals...</div>}
          {!loading && deals.length === 0 && <div>No visible deals.</div>}
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
                {deals.slice(0, 12).map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.title || "Untitled deal"}</td>
                    <td><Badge tone="info">{deal.stage ?? "lead"}</Badge></td>
                    <td>ZAR {(deal.value ?? 0).toLocaleString("en-ZA")}</td>
                    <td>
                      <Badge tone={getDealRiskTone(deal.value ?? 0)}>
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

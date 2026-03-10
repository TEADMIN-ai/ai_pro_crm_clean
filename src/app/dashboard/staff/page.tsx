"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import HeroBanner from "@/components/hero/HeroBanner";
import { getHeroImage } from "@/config/heroRules";
import type { Deal } from "@/types/deal";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import RequireRole from "@/components/auth/RequireRole";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";

function getDealRiskTone(value: number): "success" | "warning" | "danger" {
  if (value >= 500000) return "danger";
  if (value >= 100000) return "warning";
  return "success";
}

export default function StaffDashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

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
  const totalValue = useMemo(() => deals.reduce((sum, deal) => sum + (deal.value ?? 0), 0), [deals]);

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <div className="enterprise-page enterprise-grid">
        <Card>
          <HeroBanner image={heroImage} title="Staff Dashboard" subtitle="Operationally visible deals and execution queue" />
        </Card>

        <Card>
          <IdentityCardHeader title="Identity" subtitle={user?.email ?? "Signed in staff user"}>
            <Badge tone="info">Role {heroRole}</Badge>
            <Badge tone={deals.length > 0 ? "success" : "warning"}>Visible {deals.length}</Badge>
          </IdentityCardHeader>
        </Card>

        <Card>
          <h2>Compliance Score Summary</h2>
          <div className="compliance-summary">
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Visible Deals</p>
              <p className="enterprise-metric-value">{deals.length}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Pipeline Value</p>
              <p className="enterprise-metric-value">ZAR {totalValue.toLocaleString("en-ZA")}</p>
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

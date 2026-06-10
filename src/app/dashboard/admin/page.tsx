"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/types/deal";
import { computeAdminMetrics } from "@/lib/intelligence/admin/computeAdminMetrics";
import { computeRevenueHealthScore } from "@/lib/kpis/revenueHealthScore";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";
import { computeCapitalEfficiency } from "@/lib/executive/computeCapitalEfficiency";
import { computeExecutionVelocity } from "@/lib/executive/computeExecutionVelocity";
import { computePipelineQuality } from "@/lib/executive/computePipelineQuality";
import { computePortfolioExposure } from "@/lib/executive/computePortfolioExposure";
import { computeRevenueMomentum } from "@/lib/executive/computeRevenueMomentum";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import RequireRole from "@/components/auth/RequireRole";
import { useAuth } from "@/context/AuthContext";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";

function toneForScore(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function loadDeals() {
      setDeals(await getDealsForUser(user));
    }

    void loadDeals();
  }, [user]);

  const metrics = computeAdminMetrics(deals);
  const revenueHealth = computeRevenueHealthScore(deals);
  const riskScores = deals.map((d) => computeDealRisk(d));
  const avgRisk = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b.score, 0) / riskScores.length : 0;
  const conversionRate = metrics?.submissionConversion ?? 0;
  const capitalEfficiency = computeCapitalEfficiency(deals);
  const executionVelocity = computeExecutionVelocity(deals);
  const pipelineQuality = computePipelineQuality(deals);
  const portfolioExposure = computePortfolioExposure(deals);
  const revenueMomentum = computeRevenueMomentum(deals);

  return (
    <RequireRole allow={["admin"]}>
      <div className="enterprise-page enterprise-grid">
        <Card>
          <IdentityCardHeader title="Admin Control Tower" subtitle="Enterprise portfolio and compliance signals">
            <Badge tone={toneForScore(revenueHealth)}>Revenue Health {revenueHealth.toFixed(1)}%</Badge>
            <Badge tone={toneForScore(100 - avgRisk)}>Risk {avgRisk.toFixed(1)}</Badge>
            <Badge tone="info">Deals {deals.length}</Badge>
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
              <p className="enterprise-metric-label">Ready To Submit</p>
              <p className="enterprise-metric-value">{metrics.readyToSubmitCount || 0}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Manager Review Stuck</p>
              <p className="enterprise-metric-value">{metrics.managerReviewStuckCount || 0}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Submission Conversion</p>
              <p className="enterprise-metric-value">{conversionRate.toFixed(1)}%</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Execution Velocity</p>
              <p className="enterprise-metric-value">{executionVelocity.toFixed(1)}</p>
            </div>
          </div>
        </Card>

        <div className="enterprise-grid-metrics">
          <Card>
            <p className="enterprise-metric-label">Revenue Momentum</p>
            <h2 className="enterprise-metric-value">{revenueMomentum.percentage.toFixed(1)}%</h2>
            <Badge tone={revenueMomentum.trend === "up" ? "success" : revenueMomentum.trend === "down" ? "danger" : "warning"}>
              {revenueMomentum.trend}
            </Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Pipeline Quality</p>
            <h2 className="enterprise-metric-value">{pipelineQuality.score}/100</h2>
            <Badge tone={toneForScore(pipelineQuality.score)}>Quality Band</Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Capital Efficiency</p>
            <h2 className="enterprise-metric-value">{capitalEfficiency.toFixed(2)}</h2>
            <Badge tone={capitalEfficiency >= 0.8 ? "success" : "warning"}>Efficiency</Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Portfolio Exposure</p>
            <h2 className="enterprise-metric-value">{portfolioExposure}/100</h2>
            <Badge tone={portfolioExposure <= 40 ? "success" : "danger"}>Risk Exposure</Badge>
          </Card>
        </div>

        <Card>
          <h2>Portfolio Table</h2>
          <Table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Risk Indicator</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Pipeline</td>
                <td>R {metrics.totalPipelineValue?.toLocaleString() || 0}</td>
                <td><Badge tone="info">Financial</Badge></td>
              </tr>
              <tr>
                <td>Weighted Revenue</td>
                <td>R {metrics.weightedRevenue?.toLocaleString() || 0}</td>
                <td><Badge tone="info">Forecast</Badge></td>
              </tr>
              <tr>
                <td>Critical Risk Deals</td>
                <td>{metrics.criticalRiskCount || 0}</td>
                <td><Badge tone="danger">Critical</Badge></td>
              </tr>
              <tr>
                <td>High Risk Deals</td>
                <td>{metrics.highRiskCount || 0}</td>
                <td><Badge tone="warning">High</Badge></td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </RequireRole>
  );
}

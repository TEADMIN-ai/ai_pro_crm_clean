"use client";

import Link from "next/link";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import RequireRole from "@/components/auth/RequireRole";
import { useEnterpriseKpis } from "@/hooks/useEnterpriseKpis";
import { TeosOperationsHubHeroFromSnapshot } from "@/components/dashboard/TeosOperationsHubHero";

function toneForScore(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function formatRand(value?: number): string {
  return `R ${(value ?? 0).toLocaleString("en-ZA")}`;
}

export default function AdminDashboardHome() {
  const { data, loading, error } = useEnterpriseKpis();
  const readinessScore = data?.readiness.averageScore ?? 0;
  const riskCount = data?.dashboardSummary.risk ?? 0;
  const blockedCount = data?.submissions.blocked ?? 0;

  return (
    <RequireRole allow={["admin"]}>
      <div data-module="admin" className="enterprise-page enterprise-grid">
        {data ? <TeosOperationsHubHeroFromSnapshot data={data} /> : null}
        <Card>
          <IdentityCardHeader title="Admin Control Tower" subtitle="Enterprise portfolio and compliance signals">
            <Badge tone={toneForScore(readinessScore)}>Readiness {readinessScore}%</Badge>
            <Badge tone={riskCount > 0 ? "warning" : "success"}>Risk {riskCount}</Badge>
            <Badge tone="info">Opportunities {data?.opportunities.total ?? 0}</Badge>
          </IdentityCardHeader>
        </Card>

        {(loading || error) && (
          <Card>
            <p className="text-sm text-slate-600">{loading ? "Loading live enterprise KPIs..." : error}</p>
          </Card>
        )}

        <Card>
          <IdentityCardHeader title="Contractor Onboarding" subtitle="Create contractor users and onboarding invitations">
            <Link href="/dashboard/contractors" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline">
              Create Contractor User
            </Link>
          </IdentityCardHeader>
        </Card>

        <Card>
          <IdentityCardHeader title="Intelligence Center" subtitle="Open the isolated audit, decision, compliance, report, and system telemetry console">
            <Link href="/dashboard/intelligence" className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white no-underline">
              Open Intelligence Center
            </Link>
          </IdentityCardHeader>
        </Card>

        <Card>
          <h2>Compliance Score Summary</h2>
          <div className="compliance-summary">
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Ready To Submit</p>
              <p className="enterprise-metric-value">{data?.submissions.readyToSubmit ?? 0}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Blocked</p>
              <p className="enterprise-metric-value">{blockedCount}</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Submission Conversion (submitted / total)</p>
              <p className="enterprise-metric-value">{data?.submissions.conversionRate ?? 0}%</p>
            </div>
            <div className="compliance-summary-item">
              <p className="enterprise-metric-label">Avg Readiness</p>
              <p className="enterprise-metric-value">{data?.submissions.avgReadiness ?? 0}%</p>
            </div>
          </div>
        </Card>

        <div className="enterprise-grid-metrics">
          <Card>
            <p className="enterprise-metric-label">Pipeline Value</p>
            <h2 className="enterprise-metric-value">{formatRand(data?.revenue.pipelineValue)}</h2>
            <Badge tone="info">Pipeline</Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Submitted Opportunity Value</p>
            <h2 className="enterprise-metric-value">{formatRand(data?.revenue.submittedValue)}</h2>
            <Badge tone="success">Submitted</Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Average Opportunity Value</p>
            <h2 className="enterprise-metric-value">{formatRand(data?.revenue.averageValue)}</h2>
            <Badge tone="info">Portfolio</Badge>
          </Card>

          <Card>
            <p className="enterprise-metric-label">Documents</p>
            <h2 className="enterprise-metric-value">{data?.documents.total ?? 0}</h2>
            <Badge tone={(data?.documents.uploadedToday ?? 0) > 0 ? "success" : "neutral"}>Uploaded Today {data?.documents.uploadedToday ?? 0}</Badge>
          </Card>
        </div>

        <Card>
          <h2>Portfolio Table</h2>
          <Table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Operational Signal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Pipeline Opportunity Value</td>
                <td>{formatRand(data?.revenue.pipelineValue)}</td>
                <td><Badge tone="info">Pipeline</Badge></td>
              </tr>
              <tr>
                <td>Awarded or Closed Opportunity Value</td>
                <td>{formatRand(data?.revenue.awardedValue)}</td>
                <td><Badge tone="success">Awarded or closed</Badge></td>
              </tr>
              <tr>
                <td>Blocked Submissions</td>
                <td>{blockedCount}</td>
                <td><Badge tone={blockedCount > 0 ? "danger" : "success"}>Blocked</Badge></td>
              </tr>
              <tr>
                <td>At Risk Readiness</td>
                <td>{data?.readiness.atRisk ?? 0}</td>
                <td><Badge tone={(data?.readiness.atRisk ?? 0) > 0 ? "warning" : "success"}>Risk</Badge></td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </RequireRole>
  );
}

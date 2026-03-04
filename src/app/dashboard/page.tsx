"use client";

import Link from "next/link";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import ComplianceScoreCard from "@/components/intelligence/ComplianceScoreCard";
import DocumentStatusGraph from "@/components/intelligence/DocumentStatusGraph";
import DealValueGraph from "@/components/intelligence/DealValueGraph";
import AIInsightPanel from "@/components/intelligence/AIInsightPanel";
import RevenueScoreCard from "@/components/financial/RevenueScoreCard";
import RevenueTrendGraph from "@/components/financial/RevenueTrendGraph";
import DealConversionGraph from "@/components/financial/DealConversionGraph";
import ProfitProjectionPanel from "@/components/financial/ProfitProjectionPanel";
import ExecutiveSummaryPanel from "@/components/financial/ExecutiveSummaryPanel";

export default function DashboardHome() {
  const { role } = useAuth();
  const showUsersModule = role === "admin";
  const visibleModuleCount = showUsersModule ? 4 : 2;

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader
          title="Torque Empire CRM"
          subtitle="Enterprise operations dashboard"
        >
          <Badge tone="success">System Active</Badge>
          <Badge tone="info">Compliance Ready</Badge>
        </IdentityCardHeader>
      </Card>

      <div className="enterprise-grid-metrics">
        <Card>
          <p className="enterprise-metric-label">Module</p>
          <h2 className="enterprise-metric-value">Contractors</h2>
          <Link href="/dashboard/contractors">Open workspace</Link>
        </Card>
        <Card>
          <p className="enterprise-metric-label">Module</p>
          <h2 className="enterprise-metric-value">Deals</h2>
          <Link href="/dashboard/deals">Open workspace</Link>
        </Card>
        {showUsersModule && (
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Users</h2>
            <Link href="/dashboard/users">Open workspace</Link>
          </Card>
        )}
        {showUsersModule && (
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Executive</h2>
            <Link href="/dashboard/executive">Open workspace</Link>
          </Card>
        )}
      </div>
      <Card>
        <IdentityCardHeader
          title="Operations Intelligence"
          subtitle="AI-powered compliance and deal performance signals"
        >
          <Badge tone="info">Executive View</Badge>
        </IdentityCardHeader>
      </Card>
      <ComplianceScoreCard
        role={role}
        visibleModuleCount={visibleModuleCount}
      />
      <DocumentStatusGraph
        role={role}
        visibleModuleCount={visibleModuleCount}
      />
      <DealValueGraph visibleModuleCount={visibleModuleCount} />
      <AIInsightPanel role={role} visibleModuleCount={visibleModuleCount} />
      {/* Financial Intelligence Section */}
      <RevenueScoreCard />
      <RevenueTrendGraph />
      <DealConversionGraph />
      <ProfitProjectionPanel />
      <ExecutiveSummaryPanel />
    </div>
  );
}

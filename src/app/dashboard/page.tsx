"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Deal } from "@/types/deal";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";

export default function DashboardHome() {
  const { user, role } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function loadDeals() {
      const result = await getDealsForUser(user);
      setDeals(result);
    }

    void loadDeals();
  }, [user]);

  const showUsersModule = role === "admin";
  const showContractorList = role === "admin" || role === "manager" || role === "staff";
  const showExecutive = role === "admin";
  const showOperationsIntelligence = role === "admin" || role === "manager" || role === "staff";
  const readyCount = useMemo(
    () => deals.filter((deal) => deal.tenderLockStatus === "READY").length,
    [deals]
  );

  if (role === "guest") {
    return (
      <div className="enterprise-page enterprise-grid">
        <Card>
          <IdentityCardHeader title="Torque Empire CRM" subtitle="Guest access">
            <Badge tone="warning">No operational data</Badge>
          </IdentityCardHeader>
        </Card>
      </div>
    );
  }

  if (role === "contractor") {
    return (
      <div className="enterprise-page enterprise-grid">
        <Card>
          <IdentityCardHeader title="Torque Empire CRM" subtitle="Contractor workspace">
            <Badge tone="info">My company only</Badge>
          </IdentityCardHeader>
        </Card>

        <div className="enterprise-grid-metrics">
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">My Deals</h2>
            <Link href="/dashboard/deals">Open workspace</Link>
          </Card>
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">My Documents</h2>
            <Link href={`/dashboard/contractors/${encodeURIComponent(user?.contractorId ?? "")}`}>Open workspace</Link>
          </Card>
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Tender Submissions</h2>
            <p>{deals.filter((deal) => deal.status === "submitted" || deal.stage === "submitted").length} active</p>
          </Card>
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Compliance Status</h2>
            <p>{readyCount} ready</p>
          </Card>
        </div>

        <ComplianceScoreCard deals={deals} />
        <DocumentStatusGraph deals={deals} />
      </div>
    );
  }

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="Torque Empire CRM" subtitle="Enterprise operations dashboard">
          <Badge tone="success">System Active</Badge>
          <Badge tone="info">Compliance Ready</Badge>
        </IdentityCardHeader>
      </Card>

      <div className="enterprise-grid-metrics">
        {showContractorList && (
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Contractors</h2>
            <Link href="/dashboard/contractors">Open workspace</Link>
          </Card>
        )}
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
        {showExecutive && (
          <Card>
            <p className="enterprise-metric-label">Module</p>
            <h2 className="enterprise-metric-value">Executive</h2>
            <Link href="/dashboard/executive">Open workspace</Link>
          </Card>
        )}
      </div>
      {showOperationsIntelligence && (
        <>
          <Card>
            <IdentityCardHeader title="Operations Intelligence" subtitle="AI-powered compliance and deal performance signals">
              <Badge tone="info">Operational View</Badge>
            </IdentityCardHeader>
          </Card>
          <ComplianceScoreCard deals={deals} />
          <DocumentStatusGraph deals={deals} />
          <DealValueGraph deals={deals} />
          <AIInsightPanel deals={deals} />
          <RevenueScoreCard />
          <RevenueTrendGraph />
          <DealConversionGraph />
          <ProfitProjectionPanel />
          <ExecutiveSummaryPanel />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CorporateWatermark from "@/components/ui/CorporateWatermark";
import { useAuth } from "@/context/AuthContext";
import type { Deal } from "@/types/deal";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";

export default function DashboardHome() {
  const router = useRouter();
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
  const readyCount = useMemo(
    () => deals.filter((deal) => deal.tenderLockStatus === "READY").length,
    [deals]
  );
  const activeTenderCount = useMemo(
    () => deals.filter((deal) => deal.status === "submitted" || deal.stage === "submitted").length,
    [deals]
  );

  const dashboardContent =
    role === "guest" ? (
      <Card className="space-y-6">
        <IdentityCardHeader title="Torque Empire CRM" subtitle="Guest access">
          <Badge tone="warning">Limited access</Badge>
        </IdentityCardHeader>
        <p>Request an internal role to access contractors, deals, and tender workflows.</p>
      </Card>
    ) : role === "contractor" ? (
      <>
        <Card className="space-y-6">
          <IdentityCardHeader title="Torque Empire CRM" subtitle="Contractor workspace">
            <Badge tone="info">My company only</Badge>
          </IdentityCardHeader>
          <p style={{ margin: "12px 0 0", maxWidth: 640 }}>
            Manage your active submissions, review document readiness, and generate a tender pack from your company profile.
          </p>
        </Card>

        <div className="enterprise-grid-metrics">
          <Card className="space-y-6">
            <p className="enterprise-metric-label">Main module</p>
            <h2 className="enterprise-metric-value">My Deals</h2>
            <p>Monitor live tender submissions and progress.</p>
            <Link href="/dashboard/deals">Open workspace</Link>
          </Card>

          <Card className="space-y-6">
            <p className="enterprise-metric-label">Main module</p>
            <h2 className="enterprise-metric-value">My Documents</h2>
            <p>Review uploaded files and keep compliance current.</p>
            <Link href={`/dashboard/contractors/${encodeURIComponent(user?.contractorId ?? "")}`}>Open workspace</Link>
          </Card>

          <Card className="space-y-6">
            <p className="enterprise-metric-label">Tender pack</p>
            <h2 className="enterprise-metric-value">Generate Tender Pack</h2>
            <p>{readyCount} ready deals available for submission preparation.</p>
            <button
              className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow hover:bg-blue-700"
              onClick={() => router.push("/dashboard/deals")}
              type="button"
            >
              Generate Tender Pack
            </button>
          </Card>
        </div>
      </>
    ) : (
      <>
        <Card className="space-y-6">
          <IdentityCardHeader title="Torque Empire CRM" subtitle="Executive operations dashboard">
            <Badge tone="success">System active</Badge>
            <Badge tone="info">{readyCount} ready deals</Badge>
          </IdentityCardHeader>
          <p style={{ margin: "12px 0 0", maxWidth: 720 }}>
            Focus the workspace on the core operating modules and the tender pack workflow. Secondary intelligence panels have been removed from the landing view to improve readability.
          </p>
        </Card>

        <div className="enterprise-grid-metrics">
          {showContractorList && (
            <Card className="space-y-6">
              <p className="enterprise-metric-label">Main module</p>
              <h2 className="enterprise-metric-value">Contractors</h2>
              <p>Manage onboarding, compliance readiness, and document quality.</p>
              <Link href="/dashboard/contractors">Open workspace</Link>
            </Card>
          )}

          <Card className="space-y-6">
            <p className="enterprise-metric-label">Main module</p>
            <h2 className="enterprise-metric-value">Deals</h2>
            <p>Track tender opportunities, assignments, and submission status.</p>
            <Link href="/dashboard/deals">Open workspace</Link>
          </Card>

          {showUsersModule && (
            <Card className="space-y-6">
              <p className="enterprise-metric-label">Main module</p>
              <h2 className="enterprise-metric-value">Users</h2>
              <p>Control roles, access, and identity governance.</p>
              <Link href="/dashboard/users">Open workspace</Link>
            </Card>
          )}
        </div>

        <Card className="space-y-6">
          <IdentityCardHeader title="Tender Pack" subtitle="Primary submission workflow">
            <Badge tone="neutral">{activeTenderCount} active submissions</Badge>
          </IdentityCardHeader>
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              alignItems: "center",
            }}
          >
            <div>
              <p className="enterprise-metric-label">Readiness</p>
              <h2 className="enterprise-metric-value">{readyCount}</h2>
              <p>Deals currently marked TenderLock ready.</p>
            </div>

            <div>
              <p className="enterprise-metric-label">Action</p>
              <p style={{ margin: "8px 0 16px", color: "#6B7280" }}>
                Open the contractor workspace to generate and download the latest tender pack.
              </p>
              <button
                className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow hover:bg-blue-700"
                onClick={() => router.push("/dashboard/deals")}
                type="button"
              >
                Generate Tender Pack
              </button>
            </div>
          </div>
        </Card>
      </>
    );

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <CorporateWatermark />

      <div className="relative z-10">
        <div className="enterprise-page enterprise-grid">{dashboardContent}</div>
      </div>
    </div>
  );
}

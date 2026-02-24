"use client";

import Link from "next/link";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";

export default function DashboardHome() {
  const { role } = useAuth();
  const showUsersModule = role === "admin";

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
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { getGovernanceAlerts } from "@/lib/governance/alerts";
import { getGovernanceVisibilitySnapshot } from "@/lib/governance/visibility";
import DashboardHeader from "@/components/layout/DashboardHeader";
import DashboardWorkspaceNav, { type GovernanceNavBadge } from "@/components/layout/DashboardWorkspaceNav";
import { DashboardWorkspaceIdentity, DashboardWorkspaceStatus } from "@/components/layout/DashboardWorkspaceIdentity";

function buildGovernanceNavBadge(): GovernanceNavBadge {
  const snapshot = getGovernanceVisibilitySnapshot();
  const alerts = getGovernanceAlerts(snapshot);
  const highestSeverity = alerts[0]?.severity ?? "CLEAR";

  return {
    label: alerts.length > 0 ? highestSeverity : "Clear",
    count: alerts.length,
    severity: highestSeverity,
  };
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const governanceBadge = buildGovernanceNavBadge();

  return (
    <div className="dashboard-app-shell relative min-h-screen text-[color:var(--tex-text)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-[color:var(--tex-border)] bg-[color:var(--tex-surface-strong)] text-[color:var(--tex-text)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.03)] md:flex">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-6">
          <DashboardWorkspaceIdentity variant="sidebar" />
        </div>
        <DashboardWorkspaceNav governanceBadge={governanceBadge} mode="sidebar" />
        <div className="px-4 pb-5">
          <DashboardWorkspaceStatus governanceLabel={governanceBadge.label} governanceCount={governanceBadge.count} />
        </div>
      </aside>

      <div className="relative z-10 md:pl-72">
        <header className="sticky top-0 z-30 border-b border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <DashboardWorkspaceIdentity variant="header" />
              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-[color:var(--tex-border)] bg-[color:var(--tex-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--tex-text-strong)] sm:block">
                  Live workspace
                </div>
                <DashboardHeader />
              </div>
            </div>
            <DashboardWorkspaceNav governanceBadge={governanceBadge} mode="mobile" />
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

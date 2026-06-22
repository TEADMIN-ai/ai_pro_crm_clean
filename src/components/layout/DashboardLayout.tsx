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

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const governanceBadge = buildGovernanceNavBadge();

  return (
    <div className="dashboard-app-shell relative min-h-screen text-white">
      <style jsx global>{`
        [data-nextjs-dev-overlay] {
          pointer-events: none !important;
          opacity: 0 !important;
        }
        nextjs-portal {
          display: none !important;
        }
        body > div[style*="position: absolute"] {
          pointer-events: none !important;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[12rem] h-[22rem] w-[22rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[18%] h-[20rem] w-[20rem] rounded-full bg-emerald-400/5 blur-3xl" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/10 bg-[rgba(7,12,24,0.88)] text-white backdrop-blur-xl md:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <DashboardWorkspaceIdentity variant="sidebar" />
        </div>

        <DashboardWorkspaceNav governanceBadge={governanceBadge} mode="sidebar" />

        <div className="px-4 pb-5">
          <DashboardWorkspaceStatus governanceLabel={governanceBadge.label} governanceCount={governanceBadge.count} />
        </div>
      </aside>

      <div className="relative z-10 md:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(5,10,21,0.72)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <DashboardWorkspaceIdentity variant="header" />
              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 sm:block">
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

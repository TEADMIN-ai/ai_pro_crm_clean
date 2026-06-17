"use client";

import DashboardHeader from "@/components/layout/DashboardHeader";
import RequireRole from "@/components/auth/RequireRole";
import ContractorOnboardingView from "@/components/contractors/ContractorOnboardingView";
import TenderPackRequestPanel from "@/components/tender/TenderPackRequestPanel";
import { useAuth } from "@/context/AuthContext";

export default function ContractorDashboardPage() {
  const { contractorId, loading } = useAuth();

  return (
    <RequireRole allow={["contractor"]}>
      <main className="space-y-6 p-4 md:p-6">
        <div className="flex justify-end">
          <DashboardHeader />
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Loading contractor dashboard...
          </div>
        ) : contractorId ? (
          <>
            <ContractorOnboardingView contractorId={contractorId} />
            <TenderPackRequestPanel contractorId={contractorId} mode="contractor" />
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Contractor profile is not linked to this account.
          </div>
        )}
      </main>
    </RequireRole>
  );
}

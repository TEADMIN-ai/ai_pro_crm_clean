"use client";

import { useAuth } from "@/context/AuthContext";
import { isRoarCarsStaffRole, isVehicleFinanceRole } from "@/lib/auth/roleUtils";

export function DashboardWorkspaceIdentity({ variant }: { variant: "sidebar" | "header" }) {
  const { role, loading } = useAuth();
  const isRoarCarsWorkspace = isVehicleFinanceRole(role);
  const isRoarCarsStaff = isRoarCarsStaffRole(role);

  if (loading) {
    return (
      <div role="status" aria-label="Loading workspace identity">
        <p className="dashboard-eyebrow">Workspace</p>
        <div className={`${variant === "header" ? "mt-1 text-lg sm:text-xl" : "mt-2 text-2xl"} font-semibold text-white`}>
          Loading operations…
        </div>
      </div>
    );
  }

  if (variant === "header") {
    return (
      <div>
        <p className="dashboard-eyebrow">{isRoarCarsWorkspace ? "Dealer Workspace" : "Executive Workspace"}</p>
        <h1 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white sm:text-xl">
          {isRoarCarsStaff
            ? "Roar Cars SA Operations Centre"
            : isRoarCarsWorkspace
              ? "Roar Cars SA Dealer Operations"
              : "Torque Empire AI Procurement Intelligence"}
        </h1>
      </div>
    );
  }

  return (
    <>
      <p className="dashboard-eyebrow">{isRoarCarsWorkspace ? "Roar Cars SA" : "Torque Empire"}</p>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        {isRoarCarsStaff ? "Operations Centre" : isRoarCarsWorkspace ? "Dealer Workspace" : "Command Center"}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {isRoarCarsWorkspace
          ? "Vehicle inventory, listings, customer enquiries, and finance application operations."
          : "Enterprise procurement visibility for live contractor readiness and tender performance."}
      </p>
    </>
  );
}

export function DashboardWorkspaceStatus({ governanceLabel, governanceCount }: { governanceLabel: string; governanceCount: number }) {
  const { role, loading } = useAuth();
  const isRoarCarsWorkspace = isVehicleFinanceRole(role);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400" role="status">
        Loading workspace status…
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workspace</p>
      <p className="mt-3 text-sm font-medium text-slate-100">
        {isRoarCarsWorkspace ? "Dealer operations active" : "Executive monitoring active"}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        {isRoarCarsWorkspace
          ? "Roar Cars inventory and finance workflow access."
          : "Stable UI shell for portfolio and operational review."}
      </p>
      {!isRoarCarsWorkspace ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Governance
          </span>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {governanceLabel}{governanceCount > 0 ? ` ${governanceCount}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}

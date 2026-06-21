"use client";

import Link from "next/link";
import RequireRole from "@/components/auth/RequireRole";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/roleUtils";

const PROFILE_ACCESS: Exclude<UserRole, "guest">[] = [
  "admin",
  "manager",
  "staff",
  "contractor",
  "auditor",
  "viewer",
  "dealerPilot",
  "vehicleFinanceStaff",
];

function getCompanyLabel(role?: UserRole): string {
  if (role === "dealerPilot" || role === "vehicleFinanceStaff") {
    return "Roar Cars SA";
  }

  if (role === "contractor") {
    return "Independent Contractor";
  }

  return "Torque Empire";
}

function getRoleLabel(role?: UserRole): string {
  switch (role) {
    case "dealerPilot":
      return "Dealer Pilot";
    case "vehicleFinanceStaff":
      return "Vehicle Finance Staff";
    case "staff":
      return "Staff";
    case "manager":
      return "Manager";
    case "contractor":
      return "Contractor";
    case "auditor":
      return "Auditor";
    case "viewer":
      return "Viewer";
    case "admin":
      return "Admin";
    default:
      return "Guest";
  }
}

export default function ProfilePage() {
  return (
    <RequireRole allow={PROFILE_ACCESS}>
      <ProfileContent />
    </RequireRole>
  );
}

function ProfileContent() {
  const { user, role, contractorId, logout } = useAuth();

  const displayName = user?.name?.trim() || user?.displayName?.trim() || user?.email || "Account";
  const companyLabel = getCompanyLabel(role);
  const roleLabel = getRoleLabel(role);

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="My Profile" subtitle="Account management and sign-in details" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              User Name
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{displayName}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Role
            </p>
            <Badge tone="info" className="mt-2">
              {roleLabel}
            </Badge>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Company
            </p>
            <p className="mt-2 text-base font-medium text-white">{companyLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Email
            </p>
            <p className="mt-2 text-base font-medium text-white">{user?.email ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Account Details
            </p>
            <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div>
                <span className="block text-slate-500">UID</span>
                <span className="text-white">{user?.uid ?? "-"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Contractor ID</span>
                <span className="text-white">{contractorId ?? user?.contractorId ?? "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <IdentityCardHeader title="Account Actions" subtitle="Manage password and sign out securely" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login/reset-password"
            className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Change Password
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Logout
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
          >
            Return to Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}

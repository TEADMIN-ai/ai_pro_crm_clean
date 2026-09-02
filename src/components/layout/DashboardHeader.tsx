"use client";

import Link from "next/link";
import CorporateBrandMark from "@/components/branding/CorporateBrandMark";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/roleUtils";

function getCompanyLabel(role?: UserRole): string {
  if (role === "dealerPilot" || role === "vehicleFinanceStaff" || role === "ROAR_CARS_STAFF") {
    return "Torque Empire Car Division";
  }

  if (role === "contractor") {
    return "Independent Contractor";
  }

  return "Torque Empire";
}

export function getDashboardHeaderRoleLabel(role?: UserRole): string {
  switch (role) {
    case "dealerPilot":
      return "Dealer Pilot";
    case "vehicleFinanceStaff":
      return "Vehicle Finance Staff";
    case "ROAR_CARS_STAFF":
      return "Car Division Staff";
    case "staff":
      return "Staff";
    case "driver":
      return "Driver";
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

function getDisplayName(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    return name.trim();
  }

  if (email?.trim()) {
    return email.trim().split("@")[0];
  }

  return "Account";
}

export default function DashboardHeader() {
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const displayName = useMemo(
    () => getDisplayName(user?.name ?? user?.displayName ?? null, user?.email ?? null),
    [user?.displayName, user?.email, user?.name],
  );
  const companyLabel = getCompanyLabel(role);
  const roleLabel = getDashboardHeaderRoleLabel(role);

  const handleLogout = async () => {
    setMenuOpen(false);

    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Check console.");
    }
  };

  return (
    <div ref={menuRef} className="relative flex items-center justify-end">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="flex items-center gap-3 rounded-full border border-[color:var(--tex-border)] bg-white px-3 py-2 text-left text-[color:var(--tex-text-strong)] shadow-sm transition hover:border-[color:var(--tex-primary)] hover:shadow-md"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <CorporateBrandMark tone="dark" compact showTagline={false} className="shrink-0" />

        <span className="hidden flex-col text-left md:flex">
          <span className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{displayName}</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--tex-text-muted)]">{roleLabel}</span>
        </span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[18rem] rounded-[28px] border border-[color:var(--tex-border)] bg-white p-3 text-[color:var(--tex-text-strong)] shadow-[0_24px_80px_rgba(7,17,31,0.16)]"
        >
          <div className="rounded-[22px] border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--tex-primary)]">
              User Profile
            </p>
            <p className="mt-2 text-base font-semibold text-white">{displayName}</p>
            <p className="mt-1 text-sm text-slate-400">{user?.email ?? "No email available"}</p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>Role</span>
                <span className="font-medium text-white">{roleLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>Company</span>
                <span className="font-medium text-white">{companyLabel}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--tex-text-strong)] transition hover:bg-[color:var(--tex-surface)]"
            >
              My Profile
            </Link>
            <Link
              href="/login/reset-password"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/8 hover:text-white"
            >
              Change Password
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center rounded-2xl border border-[color:var(--tex-critical)]/20 bg-[color:var(--tex-critical)]/10 px-4 py-3 text-left text-sm font-semibold text-[color:var(--tex-critical)] transition hover:bg-[color:var(--tex-critical)]/15"
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

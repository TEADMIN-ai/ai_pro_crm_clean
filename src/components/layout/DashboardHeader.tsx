"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/roleUtils";

function getCompanyLabel(role?: UserRole): string {
  if (role === "dealerPilot" || role === "vehicleFinanceStaff" || role === "ROAR_CARS_STAFF") {
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
    case "ROAR_CARS_STAFF":
      return "Roar Cars Staff";
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
  const roleLabel = getRoleLabel(role);

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
        className="flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-white shadow-sm transition hover:border-cyan-400/30 hover:bg-white/[0.09]"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-100">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path
              fill="currentColor"
              d="M12 12.25a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12.25Zm0 2c-4.11 0-7.5 2.57-7.5 5.75a.75.75 0 0 0 .75.75h13.5a.75.75 0 0 0 .75-.75c0-3.18-3.39-5.75-7.5-5.75Z"
            />
          </svg>
        </span>

        <span className="hidden flex-col text-left md:flex">
          <span className="text-sm font-semibold text-white">{displayName}</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{roleLabel}</span>
        </span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[18rem] rounded-3xl border border-white/10 bg-[rgba(8,14,28,0.96)] p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
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
              className="flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/8 hover:text-white"
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
              className="flex w-full items-center rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

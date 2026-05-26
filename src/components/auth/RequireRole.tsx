"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth/roleUtils";

type NonGuestRole = Exclude<UserRole, "guest">;

export default function RequireRole({
  allow,
  children,
}: {
  allow: NonGuestRole[];
  children: ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const hasAccess = role !== "guest" && allow.includes(role);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      console.info("[RequireRole] Missing user. Redirecting to /login");
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      console.info("[RequireRole] Access denied. Redirecting to /dashboard", {
        role,
        allow,
      });
      router.replace("/dashboard");
    }
  }, [user, role, loading, allow, router, hasAccess]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2f3b54] bg-[#121826] p-6 text-white">
        <h2 className="text-lg font-semibold">Checking access</h2>
        <p className="mt-2 text-sm text-slate-300">
          Your permissions are still initializing.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-[#2f3b54] bg-[#121826] p-6 text-white">
        <h2 className="text-lg font-semibold">Redirecting to login</h2>
        <p className="mt-2 text-sm text-slate-300">
          You need to sign in to view this page.
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="rounded-xl border border-[#2f3b54] bg-[#121826] p-6 text-white">
        <h2 className="text-lg font-semibold">Redirecting to dashboard</h2>
        <p className="mt-2 text-sm text-slate-300">
          Your role does not have access to this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}


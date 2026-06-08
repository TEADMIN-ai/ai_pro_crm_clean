"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUnauthorizedRedirectPath } from "@/lib/auth/roleRouting";
import type { UserRole } from "@/lib/auth/roleUtils";

type NonGuestRole = Exclude<UserRole, "guest">;

export default function RequireRole({
  allow,
  children,
}: {
  allow: NonGuestRole[];
  children: ReactNode;
}) {
  const { user, role, loading, error: authError } = useAuth();
  const router = useRouter();
  const hasAccess = role !== "guest" && allow.includes(role);

  useEffect(() => {
    if (loading || authError) {
      return;
    }

    if (!user) {
      console.info("[RequireRole] Missing user. Redirecting to /login");
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      const redirectPath = getUnauthorizedRedirectPath(role);
      console.info("[RequireRole] Access denied. Redirecting to role dashboard", {
        role,
        allow,
        redirectPath,
      });
      router.replace(redirectPath);
    }
  }, [user, role, loading, authError, allow, router, hasAccess]);

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

  if (authError) {
    return (
      <div className="rounded-xl border border-[#2f3b54] bg-[#121826] p-6 text-white">
        <h2 className="text-lg font-semibold">Authentication needs attention</h2>
        <p className="mt-2 text-sm text-slate-300">{authError}</p>
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


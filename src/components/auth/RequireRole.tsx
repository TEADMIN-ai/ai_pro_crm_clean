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
    return <div>Checking access...</div>;
  }

  if (!user) {
    return <div>Redirecting to login...</div>;
  }

  if (!hasAccess) {
    return <div>Redirecting to dashboard...</div>;
  }

  return <>{children}</>;
}


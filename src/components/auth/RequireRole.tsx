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
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasAccess) {
      router.replace("/dashboard");
    }
  }, [user, role, loading, allow, router, hasAccess]);

  if (loading || !user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}


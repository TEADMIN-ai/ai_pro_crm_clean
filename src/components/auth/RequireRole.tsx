"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Role = "admin" | "manager" | "staff";

export default function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!role || !allow.includes(role)) {
      router.replace("/dashboard");
    }
  }, [user, role, loading, allow, router]);

  if (loading || !user || !role || !allow.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
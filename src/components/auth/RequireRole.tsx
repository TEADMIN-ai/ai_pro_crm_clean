"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

type Role = "admin" | "manager" | "staff";

type Props = {
  allow: Role[];
  fallback?: ReactNode;
  children: ReactNode;
};

export default function RequireRole({ allow, fallback, children }: Props) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  if (!user) {
    return <div style={{ padding: 40 }}>Not authenticated</div>;
  }

  // ⛑️ SAFETY: role can be null before Firestore resolves
  if (!role || !allow.includes(role as Role)) {
    console.warn("Access denied", { required: allow, role });
    return fallback ?? <p>Access denied</p>;
  }

  return <>{children}</>;
}
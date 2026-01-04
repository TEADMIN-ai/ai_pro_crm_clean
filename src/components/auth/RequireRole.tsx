"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export type Role = "user" | "admin";

type RequireRoleProps = {
  role: Role;
  children: ReactNode;
};

const ROLE_LEVEL: Record<Role, number> = {
  user: 1,
  admin: 2,
};

export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return <p>Loading…</p>;
  }

  if (!user || !userRole) {
    return <p>Not authenticated</p>;
  }

  // 🔒 role guard
  if (ROLE_LEVEL[userRole as Role] < ROLE_LEVEL[role]) {
    console.warn("Access denied. Required:", role, "User role:", userRole);
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
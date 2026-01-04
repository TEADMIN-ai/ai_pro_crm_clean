"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

type Role = "user" | "admin";

type RequireRoleProps = {
  role: Role;
  children: ReactNode;
};

export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, role: userRole, loading } = useAuth();

  // Still loading auth state
  if (loading) {
    return <p>Loading...</p>;
  }

  // Not logged in
  if (!user) {
    return <p>Not authenticated</p>;
  }

  // Admins can access user routes
  if (role === "user" && userRole === "admin") {
    return <>{children}</>;
  }

  // Role mismatch
  if (userRole !== role) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
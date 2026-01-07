"use client";

import { ReactNode } from "react";
import { useAuthContext } from "@/context/AuthContext";

type Role = "admin" | "manager" | "staff";

export default function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuthContext();

  if (loading) return null;

  if (!user || !allow.includes(user.role)) {
    return <p>Access denied</p>;
  }

  return <>{children}</>;
}
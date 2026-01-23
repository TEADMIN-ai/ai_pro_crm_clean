"use client";

import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

type Props = {
  allow: Array<"admin" | "manager" | "staff">;
  children: ReactNode;
};

export default function RequireRole({ allow, children }: Props) {
  const { user, loading } = useAuth();

  // Firebase User does not have `role` on its type.
  // We safely read it if you attached it elsewhere.
  const role = (user as any)?.role as Props["allow"][number] | undefined;

  if (loading) return null;
  if (!user) return null;

  // If role isn't available yet, don't hard-block the UI.
  // (You can tighten this later once role is guaranteed.)
  if (!role) return <>{children}</>;

  if (!allow.includes(role)) return null;

  return <>{children}</>;
}
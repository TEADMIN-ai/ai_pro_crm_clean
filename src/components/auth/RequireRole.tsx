"use client";

import { ReactNode } from "react";
import { useAuthContext } from "@/context/AuthContext";

type Props = {
  allow: string[];
  children: ReactNode;
};

export default function RequireRole({ allow, children }: Props) {
  const { role, loading } = useAuthContext();

  if (loading) return null;

  if (!role || !allow.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
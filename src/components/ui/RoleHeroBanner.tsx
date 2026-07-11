"use client";

import { useAuth } from "@/context/AuthContext";

export default function RoleHeroBanner() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="enterprise-card mb-6 border-l-4 border-[color:var(--tex-accent)]">
      <p className="dashboard-eyebrow">Welcome back</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--tex-text-strong)]">Intelligence That Drives Revenue</h2>
      <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Your workspace is synchronised and ready.</p>
    </div>
  );
}

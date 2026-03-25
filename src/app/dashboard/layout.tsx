"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";
import EmpireShell from "@/components/layout/EmpireShell";
import PostLoginBootGate from "@/components/system/PostLoginBootGate";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <AuthGuard>
      <PostLoginBootGate>
        <EmpireShell>
          <Sidebar />
          <div style={{ flex: 1 }}>
            <DashboardHeader />
            {children}
          </div>
        </EmpireShell>
      </PostLoginBootGate>
    </AuthGuard>
  );
}

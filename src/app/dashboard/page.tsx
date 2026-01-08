"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, loading } = useAuthContext();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    switch (user.role) {
      case "admin":
        router.replace("/dashboard/admin");
        break;
      case "manager":
        router.replace("/dashboard/manager");
        break;
      case "staff":
        router.replace("/dashboard/staff");
        break;
      default:
        router.replace("/login");
    }
  }, [user, loading, router]);

  return null; // no UI, just redirect
}
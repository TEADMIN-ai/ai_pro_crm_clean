"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getDashboardPath } from "@/lib/auth/roleRouting";

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    ("standalone" in window.navigator && window.navigator.standalone === true)
  );
}

export default function StandaloneRootRedirect() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading || !isStandaloneDisplayMode() || window.location.pathname !== "/") {
      return;
    }

    router.replace(user && role !== "guest" ? getDashboardPath(role) : "/login");
  }, [loading, role, router, user]);

  return null;
}

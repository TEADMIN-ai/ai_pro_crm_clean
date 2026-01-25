"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // ✅ Redirect ONLY after auth is resolved
  useEffect(() => {
    if (!loading && user && role) {
      router.replace(`/dashboard/${role}`);
    }
  }, [user, role, loading, router]);

  // ✅ Allow login page to render while loading or logged out
  if (loading || !user) {
    return <LoginForm />;
  }

  // Fallback (should never visually hit)
  return null;
}
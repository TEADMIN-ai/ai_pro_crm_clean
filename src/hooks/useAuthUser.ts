"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { UserRole } from "@/lib/auth/roleUtils";
import { type AuthUser, normalizeRole } from "@/lib/auth/userProfile";

type AuthState = {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
};

export function useAuthUser(): AuthState {
  console.log("🚀 useAuthUser HOOK MOUNTED");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔥 useEffect running");
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("🔥 Auth state changed fired");
      console.log("[useAuthUser] Auth state changed", firebaseUser);

      if (!firebaseUser) {
        console.log(" No user yet");
        console.log("[useAuthUser] No authenticated user");
        setUser(null);
        setRole("guest");
        setLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken(true);
        console.log("📡 FORCED /api/me call");
        const res = await fetch("/api/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        const nextRole = normalizeRole(data?.role);
        const nextUser = firebaseUser as AuthUser;
        nextUser.role = nextRole;

        setUser(nextUser);
        setRole(nextRole);
      } catch (error) {
        console.error("[useAuthUser] Auth flow error", error);

        const fallbackUser = firebaseUser as AuthUser;
        fallbackUser.role = "guest";
        setUser(fallbackUser);
        setRole("guest");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, role, loading };
}

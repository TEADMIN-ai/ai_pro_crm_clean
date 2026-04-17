"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type SessionDebugResponse = {
  sessionExists?: boolean;
  userId?: string | null;
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [sessionUser, setSessionUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (loading) {
        return;
      }

      if (!user) {
        console.info("[AuthGuard] No authenticated user. Redirecting to /login");
        setSessionUser(null);
        setVerifying(false);
        router.replace("/login");
        return;
      }

      try {
        const response = await authFetch(API_ROUTES.AUTH_DEBUG, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await response.json()) as SessionDebugResponse;
        const verifiedUser = payload.sessionExists ? payload.userId ?? null : null;

        if (cancelled) {
          return;
        }

        setSessionUser(verifiedUser);
        setVerifying(false);

        if (!verifiedUser || verifiedUser !== user.uid) {
          console.info("[AuthGuard] Session mismatch detected. Redirecting to /login", {
            firebaseUid: user.uid,
            sessionUser: verifiedUser,
          });
          router.replace("/login");
        }
      } catch (error) {
        console.error("Session debug check failed", error);

        if (cancelled) {
          return;
        }

        setSessionUser(null);
        setVerifying(false);
        router.replace("/login");
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [loading, router, user]);

  if (loading || verifying) {
    return <div>Loading...</div>;
  }

  if (!sessionUser || !user || sessionUser !== user.uid) {
    console.info("[AuthGuard] Rendering redirect fallback while auth state settles");
    return <div>Redirecting to login...</div>;
  }

  return <>{children}</>;
}

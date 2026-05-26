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

const SESSION_VERIFY_TIMEOUT_MS = 5000;

function AuthGuardStatus({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-[#2f3b54] bg-[#121826] p-6 text-white">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sessionFailed, setSessionFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (loading) {
        return;
      }

      if (!user) {
        console.info("[AuthGuard] No authenticated user. Redirecting to /login");
        setSessionFailed(true);
        router.replace("/login");
        return;
      }

      try {
        setSessionFailed(false);
        const response = await new Promise<Response>((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            reject(new Error("Session verification timed out"));
          }, SESSION_VERIFY_TIMEOUT_MS);

          authFetch(API_ROUTES.AUTH_DEBUG, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }).then(
            (value) => {
              window.clearTimeout(timeoutId);
              resolve(value);
            },
            (error) => {
              window.clearTimeout(timeoutId);
              reject(error);
            }
          );
        });
        const payload = (await response.json()) as SessionDebugResponse;
        const verifiedUser = payload.sessionExists ? payload.userId ?? null : null;

        if (cancelled) {
          return;
        }

        if (!verifiedUser || verifiedUser !== user.uid) {
          console.info("[AuthGuard] Session mismatch detected. Redirecting to /login", {
            firebaseUid: user.uid,
            sessionUser: verifiedUser,
          });
          setSessionFailed(true);
          router.replace("/login");
        }
      } catch (error) {
        console.error("Session debug check failed", error);

        if (cancelled) {
          return;
        }

        setSessionFailed(true);
        router.replace("/login");
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [loading, router, user]);

  if (loading) {
    return (
      <AuthGuardStatus
        title="Loading workspace"
        message="Authentication is initializing. The dashboard shell is loaded and access will resolve automatically."
      />
    );
  }

  if (!user || sessionFailed) {
    console.info("[AuthGuard] Rendering redirect fallback while auth state settles");
    return (
      <AuthGuardStatus
        title="Redirecting to login"
        message="Your session could not be confirmed. Redirecting to the login page."
      />
    );
  }

  return <>{children}</>;
}

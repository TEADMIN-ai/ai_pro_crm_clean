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
    <div className="enterprise-card p-6 text-[color:var(--tex-text)]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[color:var(--tex-text-subtle)]">{message}</p>
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, error: authError } = useAuth();
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (loading || authError) {
        return;
      }

      if (!user) {
        console.info("[AuthGuard] No authenticated user. Redirecting to /login");
        setSessionError(null);
        router.replace("/login");
        return;
      }

      try {
        setSessionError(null);
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

        if (!response.ok) {
          throw new Error(`Session verification failed with ${response.status}`);
        }

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
          setSessionError("Your Firebase session is signed in, but the server verified a different app session. Sign out and sign in again.");
        }
      } catch (error) {
        console.error("Session debug check failed", error);

        if (cancelled) {
          return;
        }

        setSessionError("You are signed in with Firebase, but the server could not verify your app session. Check Firebase Admin runtime credentials and project configuration.");
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [authError, loading, router, user]);

  if (loading) {
    return (
      <AuthGuardStatus
        title="Loading workspace"
        message="Authentication is initializing. The dashboard shell is loaded and access will resolve automatically."
      />
    );
  }

  if (authError || sessionError) {
    return (
      <AuthGuardStatus
        title="Authentication needs attention"
        message={authError ?? sessionError ?? "The server could not verify your session."}
      />
    );
  }

  if (!user) {
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

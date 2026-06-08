"use client";

import { useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import type { UserRole } from "@/lib/auth/roleUtils";
import { type AuthUser, normalizeRole } from "@/lib/auth/userProfile";
import { API_ROUTES } from "@/lib/routes";
import { auth } from "@/lib/firebase/client";

type AuthState = {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
  error: string | null;
};

const AUTH_HYDRATION_TIMEOUT_MS = 5000;
const API_ME_TIMEOUT_MS = 5000;

function getCachedRole(uid: string): UserRole {
  if (typeof window === "undefined") {
    return "guest";
  }

  return normalizeRole(window.sessionStorage.getItem(`auth-role:${uid}`));
}

function cacheRole(uid: string, role: UserRole): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(`auth-role:${uid}`, role);
}

async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
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
}

export function useAuthUser(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const hydrationDeadline = window.setTimeout(() => {
      if (!active || authEventReceived) {
        return;
      }

      setLoading(false);
    }, AUTH_HYDRATION_TIMEOUT_MS);

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      authEventReceived = true;

      if (!active) {
        return;
      }

      if (!firebaseUser) {
        setUser(null);
        setRole("guest");
        setError(null);
        setLoading(false);
        return;
      }

      const cachedRole = getCachedRole(firebaseUser.uid);
      const nextUser = firebaseUser as AuthUser;
      nextUser.role = cachedRole;

      setUser(nextUser);
      setRole(cachedRole !== "guest" ? cachedRole : "guest");
      setError(null);
      setLoading(true);

      try {
        const token = await fetchWithTimeout(firebaseUser.getIdToken(), API_ME_TIMEOUT_MS);
        const res = await fetchWithTimeout(
          fetch(API_ROUTES.ME, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          API_ME_TIMEOUT_MS
        );

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        const nextRole = normalizeRole(data?.role);

        if (nextRole === "guest") {
          throw new Error("Authenticated user has no application role");
        }

        nextUser.role = nextRole;

        if (!active) {
          return;
        }

        cacheRole(firebaseUser.uid, nextRole);
        setUser(nextUser);
        setRole(nextRole);
      } catch (error) {
        console.error("[useAuthUser] Auth flow error", error);

        if (!active) {
          return;
        }

        nextUser.role = cachedRole;
        setUser(nextUser);
        setRole(cachedRole);
        setError(
          "You are signed in with Firebase, but the server could not verify your app profile. Check Firebase Admin runtime credentials and the /users profile for this UID."
        );
      } finally {
        if (active) {
          window.clearTimeout(hydrationDeadline);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      window.clearTimeout(hydrationDeadline);
      unsubscribe();
    };
  }, []);

  return { user, role, loading, error };
}

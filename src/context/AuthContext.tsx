"use client";

import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import type { UserRole } from "@/lib/auth/roleUtils";
import {
  normalizeContractorId,
  normalizeRole,
  type AuthUser,
  type UserProfile,
} from "@/lib/auth/userProfile";
import { API_ROUTES } from "@/lib/routes";

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
  loading: true,
  logout: async () => {},
});

function mergeFirebaseUser(firebaseUser: FirebaseUser, profile: UserProfile): AuthUser {
  const merged = firebaseUser as AuthUser;
  merged.role = profile.role;
  merged.contractorId = profile.contractorId;
  merged.status = profile.status;
  merged.name = profile.name ?? firebaseUser.displayName ?? undefined;
  merged.createdAt = profile.createdAt;
  return merged;
}

function sanitizeProfile(profile: UserProfile): UserProfile {
  if (profile.role === "contractor" && !profile.contractorId) {
    return {
      ...profile,
      role: "guest",
    };
  }

  return profile;
}

async function syncServerSession(token: string): Promise<void> {
  const response = await fetch(API_ROUTES.AUTH_LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ idToken: token }),
  });

  if (!response.ok) {
    throw new Error(`Session sync failed with status ${response.status}`);
  }
}

async function clearServerSession(): Promise<void> {
  await fetch(API_ROUTES.AUTH_LOGOUT, {
    method: "POST",
    credentials: "include",
  });
}

async function fetchBootstrapProfile(token: string): Promise<UserProfile | null> {
  const response = await fetch(API_ROUTES.AUTH_BOOTSTRAP, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    user?: {
      name?: string;
      email?: string;
      role?: unknown;
      status?: string;
      contractorId?: unknown;
      createdAt?: unknown;
    } | null;
  };

  if (!payload.user) {
    return null;
  }

  return {
    name: payload.user.name,
    email: payload.user.email,
    role: normalizeRole(payload.user.role),
    status: payload.user.status,
    contractorId: normalizeContractorId(payload.user.contractorId),
    createdAt: payload.user.createdAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isActive) {
        return;
      }

      setLoading(true);

      if (!firebaseUser) {
        await clearServerSession().catch((error) => {
          console.error("Server session clear failed:", error);
        });

        if (!isActive) {
          return;
        }

        setUser(null);
        setRole("guest");
        setLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();

        await fetch(API_ROUTES.SYNC_ROLE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const refreshedToken = await firebaseUser.getIdToken(true);
        await syncServerSession(refreshedToken);

        const tokenResult = await firebaseUser.getIdTokenResult();
        const bootstrapProfile = await fetchBootstrapProfile(refreshedToken);
        const profile = sanitizeProfile({
          name: bootstrapProfile?.name ?? firebaseUser.displayName ?? undefined,
          email: bootstrapProfile?.email ?? firebaseUser.email ?? undefined,
          role: bootstrapProfile?.role ?? normalizeRole(tokenResult.claims.role),
          status: bootstrapProfile?.status,
          contractorId:
            bootstrapProfile?.contractorId ?? normalizeContractorId(tokenResult.claims.contractorId),
          createdAt: bootstrapProfile?.createdAt,
        });

        if (!isActive) {
          return;
        }

        const mergedUser = mergeFirebaseUser(firebaseUser, profile);
        setUser(mergedUser);
        setRole(profile.role);
      } catch (error) {
        console.error("Auth role resolution error:", error);
        const tokenResult = await firebaseUser.getIdTokenResult().catch(() => null);
        const fallbackProfile = sanitizeProfile({
          email: firebaseUser.email ?? undefined,
          name: firebaseUser.displayName ?? undefined,
          role: normalizeRole(tokenResult?.claims.role),
          contractorId: normalizeContractorId(tokenResult?.claims.contractorId),
        });

        if (!isActive) {
          return;
        }

        const mergedUser = mergeFirebaseUser(firebaseUser, fallbackProfile);
        setUser(mergedUser);
        setRole(fallbackProfile.role);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      await clearServerSession();
    } finally {
      setUser(null);
      setRole("guest");
      setLoading(false);
      router.replace("/login");
    }
  };

  return <AuthContext.Provider value={{ user, role, loading, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

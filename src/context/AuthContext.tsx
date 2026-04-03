"use client";

import { getIdToken, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
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
  contractorId?: string;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
  contractorId: undefined,
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

      let name = firebaseUser.displayName ?? undefined;

      try {
        const refreshedToken = await getIdToken(firebaseUser, true);
        await syncServerSession(refreshedToken).catch((error) => {
          console.error("Auth session sync failed:", error);
        });

        const res = await fetch(API_ROUTES.SYNC_ROLE, {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Role sync failed with status ${res.status}`);
        }

        const data = await res.json();

        if (!isActive) {
          return;
        }

        const profile: UserProfile = {
          email: firebaseUser.email ?? undefined,
          name,
          role: normalizeRole(data.role || "guest"),
          contractorId: normalizeContractorId(data.contractorId || null),
        };

        const mergedUser = mergeFirebaseUser(firebaseUser, profile);
        setUser(mergedUser);
        setRole(profile.role);
        setLoading(false);
      } catch (err) {
        console.error("Session role sync failed:", err);

        if (!isActive) {
          return;
        }

        setUser(null);
        setRole("guest");
        setLoading(false);
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

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, role, contractorId: user?.contractorId, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

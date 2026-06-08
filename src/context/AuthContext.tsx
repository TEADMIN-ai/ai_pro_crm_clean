"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import type { UserRole } from "@/lib/auth/roleUtils";
import { authFetch } from "@/lib/client/authFetch";
import {
  type AuthUser,
  normalizeContractorId,
} from "@/lib/auth/userProfile";
import { API_ROUTES } from "@/lib/routes";
import { useAuthUser } from "@/hooks/useAuthUser";

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  contractorId?: string;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
  contractorId: undefined,
  loading: true,
  error: null,
  logout: async () => {},
});

async function clearServerSession(): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  await authFetch(API_ROUTES.AUTH_LOGOUT, {
    method: "POST",
    credentials: "include",
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authState = useAuthUser();
  const [contractorId, setContractorId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    if (authState.loading) {
      return () => {
        cancelled = true;
      };
    }

    if (!authState.user) {
      setContractorId(undefined);
      return () => {
        cancelled = true;
      };
    }

    if (authState.role !== "contractor") {
      setContractorId(undefined);
      return () => {
        cancelled = true;
      };
    }

    async function syncContractorContext() {
      try {
        console.info("[AuthContext] Contractor detected. Syncing contractor context", {
          uid: authState.user?.uid,
        });

        const response = await authFetch(API_ROUTES.SYNC_ROLE, {
          method: "POST",
          credentials: "include",
        });
        const data = (await response.json()) as { contractorId?: string | null };

        console.info("[AuthContext] Contractor sync response", data);

        if (cancelled) {
          return;
        }

        const normalizedContractorId = normalizeContractorId(data.contractorId ?? null);
        authState.user!.contractorId = normalizedContractorId;
        setContractorId(normalizedContractorId);
      } catch (error) {
        console.error("[AuthContext] Contractor sync failed", error);

        if (cancelled) {
          return;
        }

        setContractorId(authState.user.contractorId);
      }
    }

    void syncContractorContext();

    return () => {
      cancelled = true;
    };
  }, [authState.loading, authState.role, authState.user?.uid]);

  const logout = async () => {
    try {
      await clearServerSession();
      await signOut(auth);
    } finally {
      setContractorId(undefined);
      router.replace("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        role: authState.role,
        contractorId,
        loading: authState.loading,
        error: authState.error,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

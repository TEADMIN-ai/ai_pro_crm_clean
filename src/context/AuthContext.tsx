"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export type UserRole = "admin" | "staff" | "contractor";
export type AuthUser = User & { role: UserRole | null };

type AuthContextType = {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      let resolvedRole: UserRole | null = null;

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();

        const claimRole = tokenResult.claims.role;

        if (
          claimRole === "admin" ||
          claimRole === "staff" ||
          claimRole === "contractor"
        ) {
          resolvedRole = claimRole;
        }
      } catch (error) {
        console.error("Error reading role claim:", error);
      }

      const authUser = firebaseUser as AuthUser;
      authUser.role = resolvedRole;
      setUser(authUser);
      setRole(resolvedRole);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

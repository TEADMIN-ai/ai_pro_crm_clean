"use client";

import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import type { UserRole } from "@/lib/auth/roleUtils";
import { API_ROUTES } from "@/lib/routes";

interface AuthContextType {
  user: FirebaseUser | null;
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

const VALID_ROLES: UserRole[] = ["admin", "manager", "staff", "contractor", "guest"];

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

async function getRoleFromFirestore(uid: string): Promise<UserRole | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const roleValue = (snap.data() as { role?: unknown }).role;
    const normalized = normalizeRole(roleValue);
    if (!normalized || normalized === "guest") return null;
    return normalized;
  } catch (error) {
    console.error("Failed to read Firestore role fallback:", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setRole("guest");
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const token = await firebaseUser.getIdToken();

        await fetch(API_ROUTES.SYNC_ROLE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        await firebaseUser.getIdToken(true);

        const tokenResult = await firebaseUser.getIdTokenResult();
        const claimRole = normalizeRole(tokenResult.claims.role);

        if (claimRole && claimRole !== "guest") {
          setRole(claimRole);
        } else {
          const firestoreRole = await getRoleFromFirestore(firebaseUser.uid);
          setRole(firestoreRole ?? "guest");
        }
      } catch (error) {
        console.error("Auth role resolution error:", error);
        const firestoreRole = await getRoleFromFirestore(firebaseUser.uid);
        setRole(firestoreRole ?? "guest");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
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


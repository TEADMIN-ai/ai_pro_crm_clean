"use client";

import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
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

async function getUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;

    const data = snap.data() as Record<string, unknown>;
    return {
      name: typeof data.name === "string" ? data.name : undefined,
      email: typeof data.email === "string" ? data.email : undefined,
      role: normalizeRole(data.role),
      status: typeof data.status === "string" ? data.status : undefined,
      contractorId: normalizeContractorId(data.contractorId),
      createdAt: data.createdAt,
    };
  } catch (error) {
    console.error("Failed to read Firestore user fallback:", error);
    return null;
  }
}

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>("guest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        await clearServerSession().catch((error) => {
          console.error("Server session clear failed:", error);
        });
        setUser(null);
        setRole("guest");
        setLoading(false);
        return;
      }

      try {
        const firestoreProfile = await getUserProfileFromFirestore(firebaseUser.uid);
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
        const profile = sanitizeProfile({
          name: firestoreProfile?.name ?? firebaseUser.displayName ?? undefined,
          email: firestoreProfile?.email ?? firebaseUser.email ?? undefined,
          role: firestoreProfile?.role ?? normalizeRole(tokenResult.claims.role),
          status: firestoreProfile?.status,
          contractorId:
            firestoreProfile?.contractorId ?? normalizeContractorId(tokenResult.claims.contractorId),
          createdAt: firestoreProfile?.createdAt,
        });

        const mergedUser = mergeFirebaseUser(firebaseUser, profile);
        setUser(mergedUser);
        setRole(profile.role);
      } catch (error) {
        console.error("Auth role resolution error:", error);
        const fallbackProfile = sanitizeProfile(
          (await getUserProfileFromFirestore(firebaseUser.uid)) ?? {
            email: firebaseUser.email ?? undefined,
            name: firebaseUser.displayName ?? undefined,
            role: "guest" as UserRole,
          }
        );
        const mergedUser = mergeFirebaseUser(firebaseUser, fallbackProfile);
        setUser(mergedUser);
        setRole(fallbackProfile.role);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
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

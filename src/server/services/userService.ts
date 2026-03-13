import type { AppUser } from "@/types/user";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { normalizeContractorId, normalizeRole } from "@/lib/auth/userProfile";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function normalizeUser(uid: string, data: Record<string, unknown>): AppUser {
  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    role: normalizeRole(data.role) as AppUser["role"],
    contractorId: normalizeContractorId(data.contractorId),
    status: typeof data.status === "string" ? data.status : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    createdAt: toMillis(data.createdAt) ?? Date.now(),
  };
}

export async function listUsers(): Promise<AppUser[]> {
  const snapshot = await getFirebaseAdmin().collection("users").get();
  return snapshot.docs
    .map((doc) => normalizeUser(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function getUserById(uid: string): Promise<AppUser | null> {
  const snapshot = await getFirebaseAdmin().collection("users").doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeUser(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

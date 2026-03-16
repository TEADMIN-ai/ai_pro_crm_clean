import type { UserRole } from "@/lib/auth/roleUtils";
import { getUserRole } from "@/lib/firebase/getUserRole";

export async function requireRole(
  uid: string,
  allow: UserRole[]
) {
  const role = await getUserRole(uid);
  if (!role) return false;
  return allow.includes(role);
}


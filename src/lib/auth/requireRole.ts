import { getUserRole } from "@/lib/firebase/getUserRole";

export async function requireRole(
  uid: string,
  allow: Array<"admin" | "manager" | "staff" | "contractor">
) {
  const role = await getUserRole(uid);
  if (!role) return false;
  return allow.includes(role);
}


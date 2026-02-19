import { auth } from "@/lib/firebase";
import type { Contractor } from "@/types/contractor";

export async function getContractors(): Promise<Contractor[]> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken(true);

  const res = await fetch("/api/contractors", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch contractors: ${text}`);
  }

  const payload = await res.json();

  if (!payload.contractors) {
    throw new Error("Malformed contractor response");
  }

  return payload.contractors;
}

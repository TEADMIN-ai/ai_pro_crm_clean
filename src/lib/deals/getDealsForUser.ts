import type { AuthUser } from "@/lib/auth/userProfile";
import type { Deal } from "@/types/deal";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export async function getDealsForUser(user: Pick<AuthUser, "role" | "contractorId"> | null): Promise<Deal[]> {
  if (!user || user.role === "guest") {
    return [];
  }

  const response = await authFetch(API_ROUTES.DEALS, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deals: ${response.status}`);
  }

  const payload = (await response.json()) as { deals?: Deal[] };
  return Array.isArray(payload.deals) ? payload.deals : [];
}

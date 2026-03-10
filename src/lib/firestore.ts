import type { AuthUser } from "@/lib/auth/userProfile";
import { getDealsForUser } from "@/lib/deals/getDealsForUser";
import type { Deal } from "@/types/deal";

export async function getAllDeals(user: Pick<AuthUser, "role" | "contractorId"> | null): Promise<Deal[]> {
  try {
    return await getDealsForUser(user);
  } catch (error) {
    console.error("Failed to fetch deals:", error);
    return [];
  }
}

export function countDealsByStage(
  deals: Deal[],
  stage: Deal["stage"]
): number {
  return deals.filter((d) => d.stage === stage).length;
}

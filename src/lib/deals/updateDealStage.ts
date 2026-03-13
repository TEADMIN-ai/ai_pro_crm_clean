import type { DealStage } from "@/types/deal";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export async function updateDealStage(
  dealId: string,
  nextStage: DealStage
): Promise<void> {
  if (!dealId) {
    throw new Error("updateDealStage: dealId is required");
  }

  const response = await authFetch(API_ROUTES.DEAL_STAGE(dealId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stage: nextStage,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Failed to update deal stage (${response.status})`);
  }
}

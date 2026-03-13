import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export type PricingStatus =
  | "not_started"
  | "ai_generated"
  | "manager_approved"
  | "contractor_signed_off";

async function expectOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(payload?.error ?? fallbackMessage);
}

export async function updateDealStage(
  dealId: string,
  nextStage: string,
  role: string
) {
  const response = await authFetch(API_ROUTES.DEAL_STAGE(dealId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage: nextStage, role }),
  });

  await expectOk(response, `Failed to update deal stage (${response.status})`);
}

export async function approvePricingByManager(
  dealId: string,
  managerUid: string
) {
  const response = await authFetch(API_ROUTES.DEAL_PRICING_APPROVE(dealId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ managerUid }),
  });

  await expectOk(response, `Failed to approve pricing (${response.status})`);
}

export async function signOffPricingByContractor(
  dealId: string,
  contractorUid: string
) {
  const response = await authFetch(API_ROUTES.DEAL_STAGE(dealId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stage: "approved",
      contractorUid,
    }),
  });

  await expectOk(response, `Failed to sign off pricing (${response.status})`);
}

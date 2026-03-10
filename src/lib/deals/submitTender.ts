import type { Deal } from "@/types/deal";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type SubmitTenderResponse = {
  success?: boolean;
  error?: string;
  reason?: string;
};

export async function submitTender(deal: Deal): Promise<void> {
  const response = await authFetch(API_ROUTES.DEAL_SUBMIT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dealId: deal.id,
    }),
  });

  if (response.ok) {
    return;
  }

  let message = `Failed to submit tender (${response.status})`;
  const rawBody = await response.text();

  try {
    const payload = JSON.parse(rawBody) as SubmitTenderResponse;
    message = payload.reason ?? payload.error ?? message;
  } catch {
    if (rawBody.trim()) {
      message = rawBody;
    }
  }

  throw new Error(message);
}

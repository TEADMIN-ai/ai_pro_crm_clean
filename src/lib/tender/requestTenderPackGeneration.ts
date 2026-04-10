import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/apiRoutes";

export type TenderPackGenerateResponse = {
  success?: boolean;
  packId?: string;
  downloadURL?: string;
  base64?: string;
  missingFields?: string[];
  warnings?: string[];
  error?: string;
};

export async function requestTenderPackGeneration(
  dealId: string,
): Promise<TenderPackGenerateResponse> {
  const normalizedDealId = dealId.trim();

  if (!normalizedDealId) {
    throw new Error("Missing deal ID");
  }

  const payload = { dealId: normalizedDealId };
  const response = await authFetch(API_ROUTES.TENDER_PACK_GENERATE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as TenderPackGenerateResponse;
}

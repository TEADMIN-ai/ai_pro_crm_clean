import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/apiRoutes";

export type TenderRequest = {
  dealId: string;
  contractorId: string;
};

export type TenderPackGenerateResponse = {
  success?: boolean;
  packId?: string;
  downloadURL?: string;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  expiresAt?: number;
  deliveryMode?: "artifact" | "base64";
  base64?: string;
  missingFields?: string[];
  warnings?: string[];
  error?: string;
};

export async function requestTenderPackGeneration(
  dealId: string,
  contractorId: string,
): Promise<TenderPackGenerateResponse> {
  const normalizedDealId = dealId.trim();
  const normalizedContractorId = contractorId.trim();

  if (!normalizedDealId) {
    throw new Error("Missing deal ID");
  }

  if (!normalizedContractorId) {
    throw new Error("Missing contractor ID");
  }

  const payload: TenderRequest = {
    dealId: normalizedDealId,
    contractorId: normalizedContractorId,
  };

  console.log("TENDER REQUEST:", payload);

  const response = await authFetch(API_ROUTES.TENDER_PACK_GENERATE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as TenderPackGenerateResponse;
}

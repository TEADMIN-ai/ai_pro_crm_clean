import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import type { ContractorDocument } from "@/types/document";

type DocumentsResponse = {
  documents?: ContractorDocument[];
  error?: string;
};

export async function getContractorDocuments(
  contractorId: string
): Promise<ContractorDocument[]> {
  const res = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Non-JSON API response: ${text.substring(0, 200)}`
    );
  }

  const payload = await res.json() as DocumentsResponse;

  if (!payload || !Array.isArray(payload.documents)) {
    throw new Error("Malformed contractor documents response");
  }

  return payload.documents;
}

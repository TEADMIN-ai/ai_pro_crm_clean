import { auth } from "@/lib/firebase";
import type { ContractorDocument } from "@/types/document";

type DocumentsResponse = {
  documents?: ContractorDocument[];
  error?: string;
};

export async function getContractorDocuments(
  contractorId: string
): Promise<ContractorDocument[]> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken(true);

  const res = await fetch(
    `/api/contractors/${contractorId}/documents`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `API Error ${res.status}: ${text.substring(0,200)}`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Non-JSON API response: ${text.substring(0,200)}`
    );
  }

  const payload = await res.json() as DocumentsResponse;

  if (!payload || !Array.isArray(payload.documents)) {
    throw new Error("Malformed contractor documents response");
  }

  return payload.documents;
}

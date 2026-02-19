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

  const res = await fetch(`/api/contractors/${contractorId}/documents`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await res.json()) as DocumentsResponse;

  if (!res.ok) {
    throw new Error(payload.error || "Failed to fetch contractor documents");
  }

  return payload.documents ?? [];
}

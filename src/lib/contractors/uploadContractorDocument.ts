import { auth } from "@/lib/firebase";
import { API_ROUTES } from "@/lib/routes";
import type { ContractorDocument } from "@/types/document";

type UploadResponse = {
  document?: ContractorDocument;
  error?: string;
};

export async function uploadContractorDocument(
  contractorId: string,
  name: string,
  storagePath: string,
  downloadURL: string
): Promise<ContractorDocument> {
  if (!contractorId.trim() || !name.trim() || !storagePath.trim() || !downloadURL.trim()) {
    throw new Error("Missing required upload arguments");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken(true);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(API_ROUTES.CONTRACTOR_DOCUMENTS(contractorId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        storagePath: storagePath.trim(),
        downloadURL: downloadURL.trim(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("API returned non-JSON response");
    }

    const payload = (await res.json()) as UploadResponse;

    if (!payload.document) {
      throw new Error("Upload failed");
    }

    return payload.document;
  } finally {
    clearTimeout(timeout);
  }
}

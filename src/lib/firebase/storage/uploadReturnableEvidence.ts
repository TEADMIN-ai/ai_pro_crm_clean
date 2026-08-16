import { authFetch } from "@/lib/client/authFetch";
import type { ReturnableUploadContext } from "@/lib/firebase/storage/uploadDealDocuments";

export async function uploadReturnableEvidence(dealId: string, file: File, context: ReturnableUploadContext) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("returnableKey", context.key);
  formData.append("returnableCategory", context.category);
  if (context.subtype) formData.append("returnableSubtype", context.subtype);
  if (context.note) formData.append("returnableNote", context.note);
  const response = await authFetch("/api/deals/" + encodeURIComponent(dealId) + "/document-preparation/upload", { method: "POST", body: formData });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Returnable upload failed (${response.status})`);
  }
  return response.json();
}

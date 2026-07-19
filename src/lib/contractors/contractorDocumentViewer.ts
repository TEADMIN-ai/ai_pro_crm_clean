import { authFetch } from "@/lib/client/authFetch";
import { buildContractorDocumentDownloadUrl } from "@/lib/documents/contractorDocumentDownloadUrl";
import type { ContractorDocument } from "@/types/document";

type ContractorDocumentViewResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

type PopupWindow = Window & { opener: null };

type OpenContractorDocumentInput = {
  contractorId: string;
  documentType: string;
  openWindow?: Window["open"];
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveContractorDocumentViewType(document: Pick<ContractorDocument, "documentType" | "docType" | "id">): string {
  return clean(document.documentType) || clean(document.docType) || clean(document.id);
}

export function hasContractorDocumentViewLocator(
  document: Pick<ContractorDocument, "fileUrl" | "downloadURL" | "storagePath"> & { url?: string },
): boolean {
  return Boolean(clean(document.fileUrl) || clean(document.downloadURL) || clean(document.url) || clean(document.storagePath));
}

export function buildContractorDocumentViewRequestUrl(contractorId: string, documentType: string): string {
  return `${buildContractorDocumentDownloadUrl(contractorId, documentType)}?format=json`;
}

export async function openContractorDocument(input: OpenContractorDocumentInput): Promise<string> {
  const contractorId = clean(input.contractorId);
  const documentType = clean(input.documentType);

  if (!contractorId) {
    throw new Error("Missing contractor ID for document viewer.");
  }

  if (!documentType) {
    throw new Error("Missing document type for document viewer.");
  }

  const openWindow = input.openWindow ?? (typeof window !== "undefined" ? window.open.bind(window) : undefined);
  const popup = openWindow?.("about:blank", "_blank") as PopupWindow | null | undefined;
  if (popup) {
    popup.opener = null;
  }

  try {
    const response = await authFetch(buildContractorDocumentViewRequestUrl(contractorId, documentType), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as ContractorDocumentViewResponse | null;

    if (!response.ok || payload?.success !== true || !payload.url) {
      throw new Error(payload?.error ?? `Unable to open document (${response.status})`);
    }

    if (popup) {
      popup.location.href = payload.url;
    } else if (openWindow) {
      openWindow(payload.url, "_blank", "noopener,noreferrer");
    }

    return payload.url;
  } catch (error) {
    if (popup) {
      popup.close();
    }
    throw error;
  }
}

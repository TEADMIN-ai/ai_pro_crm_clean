"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type SupportedDocumentType =
  | "cipc"
  | "bbbee"
  | "taxClearance"
  | "coida"
  | "bankConfirmation";

type Props = {
  contractorId: string;
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: SupportedDocumentType; label: string }> = [
  { value: "cipc", label: "CIPC" },
  { value: "bbbee", label: "BBBEE" },
  { value: "taxClearance", label: "Tax Clearance" },
  { value: "coida", label: "COIDA" },
  { value: "bankConfirmation", label: "Bank Confirmation" },
];

export default function UploadDocument({ contractorId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<SupportedDocumentType>("cipc");
  const [loading, setLoading] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  async function refreshContractor() {
    const response = await authFetch(
      `${API_ROUTES.CONTRACTOR_DETAIL(contractorId)}?refresh=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to refresh contractor");
    }

    router.refresh();
  }

  async function handleUpload() {
    if (!file) {
      alert("Choose a PDF file first.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("contractorId", contractorId);
      formData.append("documentType", documentType);

      const res = await fetch(API_ROUTES.DOCUMENT_UPLOAD, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed");
      }

      const payload = (await res.json().catch(() => null)) as
        | {
            error?: string;
            documentId?: string;
            document?: { id?: string };
          }
        | null;

      const documentId = payload?.documentId ?? payload?.document?.id;

      if (!documentId) {
        throw new Error("Upload succeeded but no documentId was returned");
      }

      const executeRes = await fetch(API_ROUTES.DOCUMENT_EXECUTE(documentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId }),
      });

      if (!executeRes.ok) {
        const executePayload = (await executeRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(executePayload?.error ?? "Document execution failed");
      }

      await refreshContractor();
      refreshTimeoutRef.current = window.setTimeout(() => {
        void refreshContractor().catch((error) => {
          console.error("Delayed contractor refresh failed", error);
        });
      }, 1000);

      alert("Upload successful");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
      <select
        value={documentType}
        onChange={(event) => setDocumentType(event.target.value as SupportedDocumentType)}
        disabled={loading}
      >
        {DOCUMENT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        disabled={loading}
      />

      <button type="button" onClick={handleUpload} disabled={loading || !file}>
        {loading ? "Uploading..." : "Upload Document"}
      </button>
    </div>
  );
}

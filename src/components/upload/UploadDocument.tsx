"use client";

import { useState } from "react";
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

      const res = await authFetch(API_ROUTES.DOCUMENT_UPLOAD, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed");
      }

      alert("Upload successful");
      router.refresh();
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

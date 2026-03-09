"use client";

import { ChangeEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canUpload } from "@/lib/auth/roleUtils";
import { uploadDealDocuments } from "@/lib/firebase/storage/uploadDealDocuments";

export default function UploadClient({ dealId }: { dealId: string }) {
  const router = useRouter();
  const params = useParams<{ dealId?: string | string[] }>();
  const routeDealId = Array.isArray(params.dealId) ? params.dealId[0] : params.dealId;
  const resolvedDealId = decodeURIComponent(routeDealId ?? dealId);
  const { user, role, loading } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!user) {
    return <div style={{ padding: 40 }}>You must be logged in to upload documents.</div>;
  }

  if (!canUpload(role)) {
    return <div style={{ padding: 40 }}>You do not have permission to upload documents.</div>;
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    if (!user) {
      setError("You must be logged in to upload documents.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const currentUser = user;
      await uploadDealDocuments(resolvedDealId, file, currentUser.uid, role);
      setMessage("Upload successful.");
      event.target.value = "";
    } catch (uploadError: unknown) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 640 }}>
      <h1>Upload Document</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>Deal ID: {resolvedDealId}</p>

      <div style={{ marginTop: 20 }}>
        <label
          style={{
            background: "#1e293b",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: uploading ? "not-allowed" : "pointer",
            display: "inline-block",
            fontWeight: 500,
            opacity: uploading ? 0.65 : 1,
          }}
        >
          {uploading ? "Uploading..." : "Choose PDF"}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {message && <p style={{ color: "#16a34a", marginTop: 16 }}>{message}</p>}
      {error && <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/deals/${resolvedDealId}`)}
          style={{
            border: "none",
            padding: "10px 14px",
            borderRadius: 8,
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          Back To Deal
        </button>
      </div>
    </div>
  );
}

"use client";

import { ChangeEvent, useState } from "react";
import { uploadDealDocuments } from "@/lib/firebase/storage/uploadDealDocuments";

export default function DealDocumentUpload({
  dealId,
  userId,
}: {
  dealId: string;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      await uploadDealDocuments(dealId, file, userId);

      alert("Upload successful!");
    } catch (err: any) {
      alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          background: "#1e293b",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: 8,
          cursor: "pointer",
          display: "inline-block",
          fontWeight: 500,
        }}
      >
        {uploading ? "Uploading..." : "Upload PDF"}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}


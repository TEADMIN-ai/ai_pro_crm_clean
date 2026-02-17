"use client";

import { useState } from "react";
import type { Deal, DealDocument } from "@/types/deal";
import { uploadTenderDocument } from "@/lib/tender/uploadTenderDocument";

type Props = {
  deal: Deal;
  onDocumentsChangeAction: (docs: DealDocument[]) => void;
};

export default function TenderDocumentUploader({
  deal,
  onDocumentsChangeAction,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const docs = deal.documents ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const newDoc = await uploadTenderDocument(deal.id, file);
      onDocumentsChangeAction([...docs, newDoc]);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="file"
        disabled={uploading || deal.isTenderLocked}
        onChange={handleFileChange}
      />

      {uploading && <small>Uploading�</small>}
      {docs.length > 0 && <small>{docs.length} document(s)</small>}
    </div>
  );
}


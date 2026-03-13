"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type FileItem = {
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
};

export default function DealDocumentList({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId || dealId.includes("[")) {
      setError("Invalid deal ID.");
      return;
    }

    async function loadDocuments() {
      try {
        const response = await authFetch(API_ROUTES.DEAL_DOCUMENTS(dealId));
        if (!response.ok) {
          throw new Error(`Failed to load documents (${response.status})`);
        }

        const payload = (await response.json()) as { documents?: FileItem[] };
        setFiles(Array.isArray(payload.documents) ? payload.documents : []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load deal files.");
      }
    }

    void loadDocuments();
  }, [dealId]);

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (files.length === 0) {
    return <p>No documents uploaded yet.</p>;
  }

  return (
    <div>
      {files.map((file) => (
        <div
          key={file.id}
          style={{
            background: "#1e293b",
            padding: 10,
            borderRadius: 6,
            marginBottom: 8,
            color: "#fff",
          }}
        >
          <div>{file.name}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {(file.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ))}
    </div>
  );
}

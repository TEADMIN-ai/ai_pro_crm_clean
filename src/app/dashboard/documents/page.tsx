"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type DashboardDocument = {
  id: string;
  contractorId?: string;
  documentType?: string;
  fileName: string;
  filePath?: string;
  storagePath?: string;
  downloadURL?: string;
  fileUrl?: string;
  uploadedBy?: string;
  status?: "pending" | "approved" | "rejected";
  aiStatus?: "pending" | "complete" | "failed";
  aiError?: string;
  aiIssues?: string[];
  aiSuggestion?: string;
  fixSuggestion?: string;
  uploadedAt?: number | null;
  reviewedAt?: number | null;
  reviewedBy?: string;
};

function getStatusStyle(status: DashboardDocument["status"]) {
  switch (status) {
    case "approved":
      return { background: "#d4edda", color: "#155724" };
    case "rejected":
      return { background: "#f8d7da", color: "#721c24" };
    default:
      return { background: "#fff3cd", color: "#856404" };
  }
}

export default function DocumentsPage() {
  const { role } = useAuth();
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await authFetch(API_ROUTES.DOCUMENTS);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to load documents");
      }

      const payload = (await response.json()) as { documents?: DashboardDocument[] };
      setDocuments(payload.documents ?? []);
    } catch (error) {
      console.error(error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocuments();
  }, []);

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);

      const response = await authFetch(API_ROUTES.DOCUMENT_UPLOAD, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed");
      }

      alert("Uploaded!");
      event.target.value = "";
      await fetchDocuments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateDocStatus = async (
    documentId: string,
    status: Exclude<DashboardDocument["status"], undefined | "pending">
  ) => {
    setBusyDocumentId(documentId);

    try {
      const response = await authFetch(API_ROUTES.DOCUMENT_DETAIL(documentId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to update status");
      }

      await fetchDocuments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setBusyDocumentId(null);
    }
  };

  const canReviewDocuments = role === "admin" || role === "staff" || role === "manager";

  return (
    <div style={{ padding: "20px" }}>
      <h1>Upload Document</h1>
      <input type="file" accept="application/pdf,.pdf" onChange={uploadFile} disabled={uploading} />

      <div style={{ marginTop: "24px" }}>
        <h2>Documents</h2>

        {loading ? (
          <p>Loading...</p>
        ) : documents.length === 0 ? (
          <p>No documents found.</p>
        ) : (
          <ul style={{ paddingLeft: "20px" }}>
            {documents.map((document) => {
              const downloadUrl = document.downloadURL ?? document.fileUrl ?? "";
              const status = document.status ?? "pending";
              const isBusy = busyDocumentId === document.id;

              return (
                <li key={document.id} style={{ marginBottom: "12px" }}>
                  <strong>{document.fileName}</strong>
                  {document.documentType ? <div>Type: {document.documentType}</div> : null}
                  {document.contractorId ? <div>Contractor: {document.contractorId}</div> : null}
                  <div style={{ margin: "8px 0" }}>
                    <span
                      style={{
                        ...getStatusStyle(status),
                        display: "inline-block",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        textTransform: "capitalize",
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  {downloadUrl ? (
                    <a href={downloadUrl} target="_blank" rel="noreferrer noopener">
                      Download
                    </a>
                  ) : (
                    <span>Download unavailable</span>
                  )}
                  {status === "rejected" && document.fixSuggestion ? (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "10px",
                        background: "#fff3cd",
                        borderRadius: "6px",
                      }}
                    >
                      <strong>Suggested Fix:</strong>
                      <p>{document.fixSuggestion}</p>
                    </div>
                  ) : null}
                  {document.aiStatus && document.aiStatus !== "complete" ? (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "10px",
                        background: "#fff3cd",
                        borderRadius: "6px",
                      }}
                    >
                      <strong>AI Warning:</strong>
                      {document.aiError ? <p>{document.aiError}</p> : null}
                      <ul style={{ marginBottom: "8px", marginTop: "8px", paddingLeft: "20px" }}>
                        {document.aiIssues?.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                      {document.aiSuggestion ? <p style={{ margin: 0 }}>{document.aiSuggestion}</p> : null}
                    </div>
                  ) : null}
                  {canReviewDocuments && status === "pending" ? (
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => void updateDocStatus(document.id, "approved")}
                        disabled={isBusy}
                        style={{
                          background: "#16a34a",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.65 : 1,
                          padding: "6px 12px",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateDocStatus(document.id, "rejected")}
                        disabled={isBusy}
                        style={{
                          background: "#dc2626",
                          border: "none",
                          borderRadius: "6px",
                          color: "#fff",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.65 : 1,
                          padding: "6px 12px",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

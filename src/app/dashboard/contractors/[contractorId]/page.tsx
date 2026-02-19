"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  canUploadContractorDocs,
  canViewContractorProfile,
} from "@/lib/auth/roleUtils";
import { getContractor } from "@/lib/contractors/getContractor";
import { getContractorDocuments } from "@/lib/contractors/getContractorDocuments";
import ContractorDocumentUploader from "@/components/contractors/ContractorDocumentUploader";
import type { Contractor } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";

export default function ContractorProfilePage() {
  const router = useRouter();
  const params = useParams<{ contractorId: string }>();
  const contractorId = useMemo(() => {
    const raw = params?.contractorId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const { user, role, loading } = useAuth();

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!contractorId) return;
    const docs = await getContractorDocuments(contractorId);
    setDocuments(docs);
  }, [contractorId]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canViewContractorProfile(role)) {
      router.replace("/dashboard");
      return;
    }
    if (!contractorId) {
      setError("Missing contractor ID");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (role === "contractor") {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const ownContractorId = (userDoc.data() as { contractorId?: unknown } | undefined)
            ?.contractorId;

          if (typeof ownContractorId !== "string" || ownContractorId !== contractorId) {
            router.replace("/dashboard");
            return;
          }
        }

        const [contractorRecord] = await Promise.all([
          getContractor(contractorId),
          loadDocuments(),
        ]);

        if (!cancelled) {
          setContractor(contractorRecord);
        }
      } catch (profileError) {
        if (!cancelled) {
          const message =
            profileError instanceof Error ? profileError.message : "Failed to load contractor profile";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, role, contractorId, router, loadDocuments]);

  if (loading || isLoading) {
    return <div style={{ padding: 40 }}>Loading contractor profile...</div>;
  }

  if (!user || !canViewContractorProfile(role) || !contractor) {
    return (
      <div style={{ padding: 40 }}>
        {error ? <p style={{ color: "#dc2626" }}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>{contractor.companyName}</h1>
      <p style={{ marginBottom: 4 }}><strong>Contact Person:</strong> {contractor.contactPerson}</p>
      <p style={{ marginBottom: 4 }}><strong>Email:</strong> {contractor.email}</p>
      <p style={{ marginBottom: 4 }}><strong>Phone:</strong> {contractor.phone}</p>
      <p style={{ marginBottom: 16 }}><strong>Status:</strong> {contractor.status}</p>

      {canUploadContractorDocs(role) && (
        <button
          onClick={() => setShowUploader((value) => !value)}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: 6,
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {showUploader ? "Close Upload" : "Upload Document"}
        </button>
      )}

      {showUploader && canUploadContractorDocs(role) && (
        <ContractorDocumentUploader
          contractorId={contractor.id}
          onUploaded={loadDocuments}
        />
      )}

      <h2 style={{ marginTop: 24 }}>Documents</h2>
      {documents.length === 0 ? (
        <p>No contractor documents uploaded yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 12,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={cellStyle}>Name</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Uploaded At</th>
              <th style={cellStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((item) => (
              <tr key={item.id}>
                <td style={cellStyle}>{item.name}</td>
                <td style={cellStyle}>{item.status}</td>
                <td style={cellStyle}>
                  {item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : "-"}
                </td>
                <td style={cellStyle}>
                  <button
                    onClick={() => window.open(item.downloadURL, "_blank", "noopener,noreferrer")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cellStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 6px",
};

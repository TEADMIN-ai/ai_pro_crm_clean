"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/index";
import { canDelete, canReview, canUpload } from "@/lib/auth/roleUtils";
import type { DocumentRecord } from "@/lib/firebase/storage/uploadDealDocuments";

type DealDocument = Omit<DocumentRecord, "uploadedAt" | "updatedAt" | "expiryDate" | "reviewedAt"> & {
  uploadedAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  expiryDate?: { toDate?: () => Date };
  reviewedAt?: { toDate?: () => Date };
};

export default function DealDetailsClient({ dealId }: { dealId: string }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!dealId) return;

    const q = query(collection(db, "deals", dealId, "documents"), orderBy("uploadedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Omit<DealDocument, "id">;
          return {
            id: snapshotDoc.id,
            ...data,
          };
        });

        setDocuments(docs);
        setIsLoadingDocs(false);
      },
      (error) => {
        console.error("Failed to subscribe documents:", error);
        setIsLoadingDocs(false);
      }
    );

    return () => unsubscribe();
  }, [dealId]);

  const handleStatusUpdate = async (documentId: string, newStatus: "approved" | "rejected") => {
    if (!user || !canReview(role)) return;

    setBusyDocumentId(documentId);
    try {
      await updateDoc(doc(db, "deals", dealId, "documents", documentId), {
        status: newStatus,
        reviewedByUid: user.uid,
        reviewedByRole: role,
        reviewedAt: serverTimestamp(),
        rejectionReason: newStatus === "rejected" ? "Rejected by reviewer" : "",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Status update failed:", error);
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleDelete = async (docItem: DealDocument) => {
    if (!user || !canDelete(role, docItem.uploadedByUid, user.uid)) return;

    setBusyDocumentId(docItem.id);
    try {
      if (docItem.storagePath) {
        await deleteObject(ref(storage, docItem.storagePath));
      }

      await deleteDoc(doc(db, "deals", dealId, "documents", docItem.id));
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setBusyDocumentId(null);
    }
  };

  if (loading || isLoadingDocs) {
    return <div style={{ padding: 40 }}>Loading documents...</div>;
  }

  if (!user) return null;

  return (
    <div style={{ padding: 40 }}>
      <h1>Deal Documents</h1>
      <p style={{ opacity: 0.6 }}>Deal ID: {dealId}</p>

      {canUpload(role) && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/dashboard/deals/${dealId}/upload`)}
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Upload PDF
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 20,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((docItem) => {
              const canDeleteThisDoc = canDelete(role, docItem.uploadedByUid, user.uid);
              const isBusy = busyDocumentId === docItem.id;

              return (
                <tr key={docItem.id}>
                  <td>{docItem.name}</td>
                  <td>{docItem.status ?? "pending"}</td>
                  <td>{docItem.uploadedAt?.toDate?.() ? docItem.uploadedAt.toDate().toLocaleString() : "-"}</td>
                  <td>
                    <button
                      onClick={() => window.open(docItem.downloadURL, "_blank", "noopener,noreferrer")}
                      style={{
                        marginRight: 8,
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>

                    {canReview(role) && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(docItem.id, "approved")}
                          disabled={isBusy}
                          style={{
                            marginRight: 8,
                            background: "#16a34a",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            opacity: isBusy ? 0.65 : 1,
                          }}
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => handleStatusUpdate(docItem.id, "rejected")}
                          disabled={isBusy}
                          style={{
                            marginRight: 8,
                            background: "#f97316",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            opacity: isBusy ? 0.65 : 1,
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {canDeleteThisDoc && (
                      <button
                        onClick={() => handleDelete(docItem)}
                        disabled={isBusy}
                        style={{
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                          opacity: isBusy ? 0.65 : 1,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

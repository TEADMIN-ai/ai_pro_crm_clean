"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";

type DocumentItem = {
  id: string;
  name: string;
  downloadURL: string;
  storagePath: string;
  uploadedAt?: { seconds: number };
};

export default function DealDetailsClient({
  dealId,
}: {
  dealId: string;
}) {
  const { role, loading } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 🔒 Guard
  useEffect(() => {
    if (!loading && !role) {
      router.replace("/login");
    }
  }, [loading, role, router]);

  // 📡 Realtime listener
  useEffect(() => {
    if (!dealId) return;

    const q = query(
      collection(db, "deals", dealId, "documents"),
      orderBy("uploadedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: DocumentItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<DocumentItem, "id">),
      }));

      setDocuments(docs);
    });

    return () => unsubscribe();
  }, [dealId]);

  // 🗑 Delete handler
  const handleDelete = async (documentItem: DocumentItem) => {
    if (role !== "admin") return;

    const confirmed = confirm(
      `Are you sure you want to delete "${documentItem.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(documentItem.id);

      // Delete from Storage
      const storageRef = ref(storage, documentItem.storagePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      await deleteDoc(
        doc(db, "deals", dealId, "documents", documentItem.id)
      );
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Loading deal details…</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ marginBottom: 10 }}>Deal Details</h1>
      <p style={{ opacity: 0.6 }}>Deal ID: {dealId}</p>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={() =>
            router.push(`/dashboard/deals/${dealId}/upload`)
          }
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Upload Document
        </button>
      </div>

      <h2 style={{ marginTop: 40 }}>Documents</h2>

      {documents.length === 0 && (
        <p style={{ opacity: 0.6 }}>No documents uploaded yet.</p>
      )}

      <div style={{ marginTop: 20 }}>
        {documents.map((docItem) => (
          <div
            key={docItem.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "white",
              padding: "14px 18px",
              borderRadius: 8,
              marginBottom: 12,
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <div>
              <strong>{docItem.name}</strong>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                Uploaded:{" "}
                {docItem.uploadedAt
                  ? new Date(
                      docItem.uploadedAt.seconds * 1000
                    ).toLocaleString()
                  : "—"}
              </div>
            </div>

            <div>
              <button
                onClick={() =>
                  window.open(docItem.downloadURL, "_blank")
                }
                style={{
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                View
              </button>

              {role === "admin" && (
                <button
                  onClick={() => handleDelete(docItem)}
                  disabled={deletingId === docItem.id}
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    marginLeft: 8,
                    opacity:
                      deletingId === docItem.id ? 0.6 : 1,
                  }}
                >
                  {deletingId === docItem.id
                    ? "Deleting…"
                    : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
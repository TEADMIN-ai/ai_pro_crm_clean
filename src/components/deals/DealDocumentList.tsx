"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, onSnapshot } from "firebase/firestore";

type FileItem = {
  id: string;
  name: string;
  size: number;
  uploadedBy: string;
  uploadedAt: any;
};

export default function DealDocumentList({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId || dealId.includes("[")) {
      setError("Invalid deal ID.");
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "deals", dealId, "documents"),
      (snapshot) => {
        const fileList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FileItem[];

        setFiles(fileList);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError("Failed to load deal files.");
      }
    );

    return () => unsubscribe();
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


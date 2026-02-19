"use client";

import { useMemo, useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { uploadContractorDocument } from "@/lib/contractors/uploadContractorDocument";

export default function ContractorDocumentUploader({
  contractorId,
  onUploaded,
}: {
  contractorId: string;
  onUploaded: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!file && fileName.trim().length > 0;
  }, [file, fileName]);

  async function handleUpload() {
    if (!file) {
      setError("Please select a file");
      return;
    }

    if (!canSubmit) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedName = fileName.trim();
      const uploadFile =
        normalizedName === file.name
          ? file
          : new File([file], normalizedName, {
              type: file.type,
              lastModified: file.lastModified,
            });

      const storage = getStorage();
      const storageRef = ref(
        storage,
        `contractors/${contractorId}/documents/${normalizedName}`
      );

      await uploadBytes(storageRef, uploadFile);
      const storagePath = storageRef.fullPath;
      const downloadURL = await getDownloadURL(storageRef);

      await uploadContractorDocument(
        contractorId,
        normalizedName,
        storagePath,
        downloadURL
      );

      setFile(null);
      setFileName("");
      await onUploaded();
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Upload failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        background: "#f8fafc",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Upload contractor document</h3>

      <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          type="file"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setFileName(selected?.name ?? "");
          }}
        />

        <input
          type="text"
          placeholder="File name"
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
        />
      </div>

      {error && (
        <p style={{ color: "#dc2626", marginTop: 10, marginBottom: 0 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !canSubmit}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          border: "none",
          borderRadius: 6,
          background: "#2563eb",
          color: "white",
          cursor: loading || !canSubmit ? "not-allowed" : "pointer",
          opacity: loading || !canSubmit ? 0.7 : 1,
        }}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}

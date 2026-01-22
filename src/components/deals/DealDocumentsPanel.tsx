"use client";

import { useEffect, useState } from "react";
import { uploadDealFile, getDealFiles, type DealFile } from "@/lib/firebase/dealFiles";
import { useAuthContext } from "@/context/AuthContext";

export default function DealDocumentsPanel({ dealId }: { dealId: string }) {
  const { user } = useAuthContext();
  const [files, setFiles] = useState<DealFile[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const data = await getDealFiles(dealId);
    setFiles(data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const onUpload = async (file?: File | null) => {
    if (!user || !file) return;
    setBusy(true);
    try {
      await uploadDealFile({
        dealId,
        file,
        uploadedBy: user.uid,
        companyId: user.companyId,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Documents</div>
        <label style={{ cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          <input
            type="file"
            style={{ display: "none" }}
            onChange={(e) => onUpload(e.target.files?.[0])}
            disabled={busy}
          />
          <span style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.18)" }}>
            {busy ? "Uploading…" : "Upload"}
          </span>
        </label>
      </div>

      {files.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No documents yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {files.map((f) => (
            <a
              key={f.id}
              href={f.fileUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#fff", textDecoration: "underline", opacity: 0.95 }}
            >
              {f.fileName}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

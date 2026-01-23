"use client";

import { useState } from "react";

type Props = {
  dealId: string;
};

export default function DealFiles({ dealId }: Props) {
  const [files] = useState<string[]>([]);

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>
        Deal Documents
      </strong>

      {/* Upload placeholder */}
      <button
        style={{
          background: "#2563eb",
          color: "#fff",
          padding: "6px 14px",
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,.35)",
          marginBottom: 12,
        }}
        disabled
      >
        Upload Document (coming soon)
      </button>

      {/* File list */}
      {files.length === 0 && (
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          No documents uploaded yet.
        </div>
      )}
    </div>
  );
}

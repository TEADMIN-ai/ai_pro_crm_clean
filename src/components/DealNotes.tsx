"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

type Props = {
  dealId: string;
};

export default function DealNotes({ dealId }: Props) {
  const { user } = useAuth();
  const [note, setNote] = useState("");

  const companyId = (user as any)?.companyId;

  if (!user || !companyId) return null;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
        marginTop: 16,
      }}
    >
      <h4 style={{ marginBottom: 8 }}>Notes</h4>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note…"
        style={{
          width: "100%",
          minHeight: 80,
          borderRadius: 8,
          padding: 10,
          border: "none",
          outline: "none",
          marginBottom: 8,
        }}
      />

      <button
        type="button"
        disabled
        style={{
          background: "#2563eb",
          color: "#fff",
          borderRadius: 8,
          padding: "6px 12px",
          fontWeight: 600,
          border: "none",
          opacity: 0.6,
        }}
      >
        Notes enabled in Phase 3
      </button>
    </div>
  );
}

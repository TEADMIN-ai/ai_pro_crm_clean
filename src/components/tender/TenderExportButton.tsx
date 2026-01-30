"use client";

// src/components/tender/TenderExportButton.tsx

import { useState } from "react";

type Props = {
  /** Called when user confirms export */
  onExportAction: () => Promise<void>;

  /** Disable button when tender is locked or not ready */
  disabled?: boolean;

  /** Optional label override */
  label?: string;
};

export default function TenderExportButton({
  onExportAction,
  disabled = false,
  label = "Export Tender Package",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (disabled || loading) return;

    setError(null);
    setLoading(true);

    try {
      await onExportAction();
    } catch (err) {
      console.error("Tender export failed", err);
      setError("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        style={{
          padding: "12px 18px",
          borderRadius: 10,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled
            ? "#94a3b8"
            : "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#fff",
          fontWeight: 600,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        {loading ? "Preparing export…" : label}
      </button>

      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
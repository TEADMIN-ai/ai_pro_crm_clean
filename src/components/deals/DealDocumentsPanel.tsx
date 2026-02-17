"use client";

import { useAuth } from "@/context/AuthContext";

type Props = {
  dealId: string;
};

export default function DealDocumentsPanel({ dealId }: Props) {
  const { user } = useAuth();
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
      <h4 style={{ marginBottom: 8 }}>Documents</h4>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        Document uploads will be enabled in Phase 3.
      </p>
    </div>
  );
}


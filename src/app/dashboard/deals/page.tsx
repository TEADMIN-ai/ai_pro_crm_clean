"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { canCreateDeal } from "@/lib/auth/roleUtils";

export default function DealsPage() {
  const { role } = useAuth();

  return (
    <div>
      <h1>Deals</h1>

      {canCreateDeal(role) && (
        <div style={{ marginTop: 20 }}>
          <Link
            href="/dashboard/deals/new"
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            Create Deal
          </Link>
        </div>
      )}
    </div>
  );
}

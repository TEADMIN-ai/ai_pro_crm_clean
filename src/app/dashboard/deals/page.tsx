"use client";

import Link from "next/link";

export default function DealsPage() {
  return (
    <div>
      <h1>Deals</h1>

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
    </div>
  );
}
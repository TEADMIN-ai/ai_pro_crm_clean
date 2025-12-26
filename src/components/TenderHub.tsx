'use client';

import React from "react";
import Link from "next/link";

interface Props {
  tenderId: string;
}

export default function TenderHub({ tenderId }: Props) {
  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
        Tender Control Hub
      </h1>
      <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
        Tender ID: {tenderId}
      </p>

      <div
        style={{
          marginTop: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <Link
          href={`/tenders/${tenderId}/summary`}
          style={{ color: "#00e0ff", fontSize: "1.2rem" }}
        >
          ðŸ“„ View AI Tender Summary
        </Link>

        <Link
          href={`/tenders/${tenderId}/summary/fix`}
          style={{ color: "#00ff72", fontSize: "1.2rem" }}
        >
          ðŸ›  AI Fix Suggestions
        </Link>
      </div>
    </div>
  );
}


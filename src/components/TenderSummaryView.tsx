'use client';

import React, { useEffect, useState } from "react";

interface Props {
  tenderId: string;
}

export default function TenderSummaryView({ tenderId }: Props) {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/ai/tender-summary?tenderId=${tenderId}`, {
        method: "POST",
      });

      const data = await res.json();
      setSummary(data.summary);
    }

    load();
  }, [tenderId]);

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
        AI Tender Summary
      </h1>

      {!summary && <p>Loading summary...</p>}

      {summary && (
        <pre
          style={{
            marginTop: "1rem",
            background: "#111",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          {JSON.stringify(summary, null, 2)}
        </pre>
      )}
    </div>
  );
}


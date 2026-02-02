"use client";

import type { TenderAuditEvent } from "@/lib/tender/getTenderAudit";

type Props = {
  events: TenderAuditEvent[];
};

export default function TenderAuditTimeline({ events }: Props) {
  if (!events.length) {
    return (
      <div style={{ opacity: 0.6, fontStyle: "italic" }}>
        No audit history available.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 8 }}>Tender Audit Trail</h4>

      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {events.map((event) => (
          <li
            key={event.id}
            style={{
              padding: "8px 12px",
              marginBottom: 8,
              borderRadius: 8,
              background: "rgba(255,255,255,0.6)",
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {event.action.replace("_", " ")}
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {event.timestamp
                ? event.timestamp.toLocaleString()
                : "Unknown time"}
              {" • "}
              {event.performedBy}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
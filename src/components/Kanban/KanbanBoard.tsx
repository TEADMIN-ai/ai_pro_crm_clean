"use client";

import { useEffect, useState } from "react";

export type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string | null;
  createdAt?: any;
  slaHours?: number; // optional override (if you later store per-deal SLA)
};

type Props = {
  deals: Deal[];
  canEdit: boolean;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"];

/**
 * ✅ Phase E: Auto-assign SLA by stage
 * Adjust these numbers anytime.
 */
function slaHoursForStatus(status: string): number {
  switch (status) {
    case "new":
      return 2; // respond fast
    case "contacted":
      return 6;
    case "negotiation":
      return 24;
    case "won":
      return 72; // post-sale paperwork follow-ups
    case "lost":
      return 72; // wrap-up + feedback window
    default:
      return 24; // safe fallback
  }
}

export default function KanbanBoard({ deals, canEdit }: Props) {
  const [now, setNow] = useState(Date.now());

  // ⏱ refresh SLA timers every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  function getSlaInfo(deal: Deal) {
    if (!deal.createdAt) return null;

    // ✅ Use per-deal override if present, otherwise auto-map from status
    const slaHours = deal.slaHours ?? slaHoursForStatus(deal.status);

    const created =
      deal.createdAt.toMillis?.() ?? new Date(deal.createdAt).getTime();

    const deadline = created + slaHours * 60 * 60 * 1000;
    const diffMs = deadline - now;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 0) {
      return { label: `Overdue • SLA ${slaHours}h`, color: "#dc2626" };
    }

    if (diffMinutes <= 120) {
      return { label: `${diffMinutes}m left • SLA ${slaHours}h`, color: "#f59e0b" };
    }

    const hoursLeft = Math.floor(diffMinutes / 60);
    return { label: `${hoursLeft}h left • SLA ${slaHours}h`, color: "#16a34a" };
  }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {STATUSES.map((status) => (
        <div
          key={status}
          style={{
            flex: 1,
            background: "#0f172a",
            borderRadius: 8,
            padding: 12,
            minHeight: 500,
          }}
        >
          <h3 style={{ color: "#e5e7eb", marginBottom: 12 }}>
            {status.toUpperCase()}
          </h3>

          {deals
            .filter((d) => d.status === status)
            .map((deal) => {
              const sla = getSlaInfo(deal);

              return (
                <div
                  key={deal.id}
                  style={{
                    background: "#020617",
                    color: "#e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 10,
                    border: "1px solid #1e293b",
                  }}
                >
                  <strong>{deal.title}</strong>

                  {sla && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: sla.color,
                        fontWeight: 600,
                      }}
                    >
                      ⏱ {sla.label}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
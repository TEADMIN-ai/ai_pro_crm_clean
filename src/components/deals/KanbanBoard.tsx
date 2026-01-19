"use client";

import DealCard from "@/components/deals/DealCard";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  assignedTo?: string | null;
  slaDueAt?: any;
};

type Props = {
  deals: Deal[];
  onMove: (dealId: string, nextStatus: string) => Promise<void>;
  canDrag?: boolean;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"] as const;

export default function KanbanBoard({ deals, onMove, canDrag = true }: Props) {
  const byStatus: Record<string, Deal[]> = {};
  for (const s of STATUSES) byStatus[s] = [];

  for (const d of deals) {
    const s = (d.status ?? "new").toLowerCase();
    (byStatus[s] ?? (byStatus["new"] ||= [])).push(d);
  }

  const onDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("text/plain", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e: React.DragEvent, nextStatus: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    if (!dealId) return;
    await onMove(dealId, nextStatus);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const colStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 260,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 12,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  };

  const pillStyle: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.8,
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
  };

  const statusTitle = (s: string) =>
    s === "new" ? "New" : s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        overflowX: "auto",
        paddingBottom: 10,
      }}
    >
      {STATUSES.map((status) => (
        <section
          key={status}
          style={colStyle}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, status)}
        >
          <div style={headerStyle}>
            <strong style={{ fontSize: 14 }}>{statusTitle(status)}</strong>
            <span style={pillStyle}>{byStatus[status]?.length ?? 0}</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {(byStatus[status] ?? []).map((deal) => (
              <div
                key={deal.id}
                draggable={canDrag}
                onDragStart={(e) => onDragStart(e, deal.id)}
                style={{
                  cursor: canDrag ? "grab" : "default",
                }}
              >
                <DealCard deal={deal} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
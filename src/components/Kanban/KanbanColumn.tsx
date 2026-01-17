"use client";

import { useDroppable } from "@dnd-kit/core";
import KanbanCard, { Deal } from "./KanbanCard";

type Props = {
  id: string;
  title: string;
  deals: Deal[];
};

export default function KanbanColumn({ id, title, deals }: Props) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        padding: 12,
        minHeight: 300,
      }}
    >
      <h3 style={{ marginBottom: 12 }}>{title}</h3>

      {deals.map((deal) => (
        <KanbanCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}
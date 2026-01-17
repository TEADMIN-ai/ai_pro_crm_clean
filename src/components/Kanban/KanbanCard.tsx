"use client";

import { useDraggable } from "@dnd-kit/core";

export type Deal = {
  id: string;
  title: string;
  status: string;
};

type Props = {
  deal: Deal;
};

export default function KanbanCard({ deal }: Props) {
  const { attributes, listeners, setNodeRef, transform } =
    useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        cursor: "grab",
      }}
    >
      <strong>{deal.title}</strong>
    </div>
  );
}
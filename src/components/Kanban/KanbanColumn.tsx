"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export default function KanbanColumn({ title, children }: Props) {
  return (
    <div
      style={{
        minWidth: 260,
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <h4 style={{ marginBottom: 12 }}>{title}</h4>
      <div>{children}</div>
    </div>
  );
}

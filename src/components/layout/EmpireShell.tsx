"use client";

import type { ReactNode } from "react";
import { empireColors } from "@/theme/empireTheme";

type EmpireShellProps = {
  children: ReactNode;
};

export default function EmpireShell({ children }: EmpireShellProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        position: "relative",
        background: "#F8FAFC",
        color: empireColors.textPrimary,
      }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

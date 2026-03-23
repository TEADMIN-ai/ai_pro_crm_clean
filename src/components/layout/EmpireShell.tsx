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
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "8rem",
          fontWeight: 700,
          color: "rgba(37, 99, 235, 0.1)",
          letterSpacing: 6,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
          textTransform: "uppercase",
        }}
      >
        Torque Empire PTY Ltd
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

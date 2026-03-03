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
        background:
          "radial-gradient(circle at 15% 0%, rgba(124,58,237,0.14), transparent 35%), radial-gradient(circle at 85% 5%, rgba(0,240,255,0.12), transparent 40%), linear-gradient(165deg, #05080F 0%, #070E1A 42%, #0B1220 100%)",
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
          color: "rgba(0, 240, 255, 0.03)",
          letterSpacing: 6,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
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

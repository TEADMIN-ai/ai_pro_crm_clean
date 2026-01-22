import { ReactNode } from "react";

export default function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.92)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        color: "#e5e7eb",
      }}
    >
      {children}
    </div>
  );
}
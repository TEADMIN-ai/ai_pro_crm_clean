"use client";

import { useState } from "react";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          color: "#fff",
        }}
        aria-label="Notifications"
      >
        🔔
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "120%",
            width: 260,
            background: "rgba(15, 23, 42, 0.95)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            zIndex: 200,
          }}
        >
          <strong style={{ color: "#fff", fontSize: 14 }}>
            Notifications
          </strong>

          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              opacity: 0.75,
              color: "#e5e7eb",
            }}
          >
            No notifications yet.
          </div>
        </div>
      )}
    </div>
  );
}

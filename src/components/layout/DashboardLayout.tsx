"use client";

import React from "react";
import { useAuthContext } from "@/context/AuthContext";
import Sidebar from "./Sidebar";

type Props = {
  children: React.ReactNode;
  title?: string;
};

export default function DashboardLayout({ children, title }: Props) {
  const { user, logout } = useAuthContext();

  if (!user) return null;

  return (
    <div style={styles.layout}>
      <Sidebar />

      <div style={styles.main}>
        {/* Top Header */}
        <header style={styles.header}>
          <div />

          <div style={styles.userBox}>
            <span style={styles.email}>{user.email}</span>
            <button style={styles.logout} onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={styles.content}>
          {title && <h1 style={styles.pageTitle}>{title}</h1>}
          <div style={styles.card}>{children}</div>
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  header: {
    height: 64,
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#020617",
    borderBottom: "1px solid #1f2937",
  },

  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  email: {
    fontSize: 14,
    color: "#cbd5f5",
  },

  logout: {
    backgroundColor: "#1f2937",
    color: "#f9fafb",
    border: "1px solid #374151",
    padding: "6px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },

  content: {
    flex: 1,
    padding: 32,
  },

  pageTitle: {
    marginBottom: 20,
    fontSize: 28,
    fontWeight: 600,
    color: "#f9fafb",
  },

  card: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 14,
    padding: 28,
    boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
  },
};
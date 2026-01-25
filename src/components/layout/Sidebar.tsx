"use client";

import Link from "next/link";
import type { UserRole } from "@/types/auth";

type SidebarProps = {
  role: UserRole;
};

export default function Sidebar({ role }: SidebarProps) {
  return (
    <aside style={{ width: 220, padding: 16, background: "#0f172a", color: "#fff" }}>
      {role === "admin" && (
        <>
          <h4>Admin Links</h4>
          <Link href="/dashboard/admin">Admin Dashboard</Link><br />
          <Link href="/dashboard/users">Users</Link><br />
          <Link href="/dashboard/deals">Deals</Link>
        </>
      )}

      {role === "manager" && (
        <>
          <h4>Manager Links</h4>
          <Link href="/dashboard/manager">Manager Dashboard</Link><br />
          <Link href="/dashboard/deals">Deals</Link>
        </>
      )}

      {role === "staff" && (
        <>
          <h4>Staff Links</h4>
          <Link href="/dashboard/staff">Staff Dashboard</Link><br />
          <Link href="/dashboard/deals">My Deals</Link>
        </>
      )}
    </aside>
  );
}
"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type User = {
  uid: string;
  email: string;
  role: string;
};

type Props = {
  dealId: string;
  assignedTo?: string;
};

export default function DealAssigneeSelect({ dealId, assignedTo }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStaff() {
      const response = await authFetch(API_ROUTES.USERS);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { users?: User[] };
      const allUsers = Array.isArray(payload.users) ? payload.users : [];
      setUsers(allUsers.filter((user) => user.role === "staff"));
    }

    void loadStaff();
  }, []);

  async function assign(uid: string) {
    setLoading(true);
    try {
      await authFetch(API_ROUTES.DEAL_ASSIGNMENT(dealId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedTo: uid,
        }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      disabled={loading}
      value={assignedTo || ""}
      onChange={(e) => assign(e.target.value)}
      style={{
        marginTop: 10,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.06)",
        color: "white",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <option value="">Unassigned</option>
      {users.map((user) => (
        <option key={user.uid} value={user.uid}>
          {user.email}
        </option>
      ))}
    </select>
  );
}

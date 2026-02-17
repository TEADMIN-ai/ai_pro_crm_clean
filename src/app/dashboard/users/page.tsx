"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@\/lib\/firebase";
import Link from "next/link";
import type { AppUser } from "@/types/user";

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const data: AppUser[] = snapshot.docs.map((doc) => doc.data() as AppUser);
        setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) {
    return <div style={{ padding: 40 }}>Loading users…</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Users</h1>

      {users.length === 0 && <p>No users found.</p>}

      {users.map((user) => (
        <div
          key={user.uid}
          style={{
            padding: 16,
            marginBottom: 12,
            borderRadius: 8,
            background: "rgba(255,255,255,0.7)",
          }}
        >
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>

          <Link href={`/dashboard/users/${user.uid}`}>
            View Profile
          </Link>
        </div>
      ))}
    </div>
  );
}


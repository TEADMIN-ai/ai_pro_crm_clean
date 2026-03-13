"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

interface UserDoc {
  uid: string;
  email: string;
  role: string;
  contractorId?: string;
  createdAt?: number;
  status?: string;
  name?: string;
}

export default function UserProfileClient({ uid }: { uid: string }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!uid) {
          setNotFound(true);
          return;
        }

        const response = await authFetch(API_ROUTES.USER_DETAIL(uid));
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to fetch user (${response.status})`);
        }

        const payload = (await response.json()) as { user?: UserDoc };
        if (!payload.user) {
          setNotFound(true);
          return;
        }

        setUser(payload.user);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchUser();
  }, [uid]);

  if (loading) return <div style={{ padding: 40 }}>Loading user profile...</div>;
  if (notFound || !user) return <div style={{ padding: 40 }}>User not found.</div>;

  return (
    <div style={{ padding: 40 }}>
      <h1>User Profile</h1>
      <div style={{ marginTop: 20 }}>
        <p><strong>UID:</strong> {uid}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Contractor:</strong> {user.contractorId ?? "-"}</p>
      </div>
    </div>
  );
}

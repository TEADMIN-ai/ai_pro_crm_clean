"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

interface UserDoc {
  email: string;
  role: string;
  companyId: string;
  createdAt?: any;
}

export default function UserProfileClient({ uid }: { uid: string }) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    
    const fetchUser = async () => {
      try {
        if (!db) {
          console.error("Firestore db is undefined");
          setNotFound(true);
          return;
        }

        if (!uid) {
          console.error("UID is empty/undefined");
          setNotFound(true);
          return;
        }

        const snap = await getDoc(doc(db, "users", uid));

        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setUser(snap.data() as UserDoc);
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [uid]);

  if (loading) return <div style={{ padding: 40 }}>Loading user profile…</div>;
  if (notFound || !user) return <div style={{ padding: 40 }}>User not found.</div>;

  return (
    <div style={{ padding: 40 }}>
      <h1>User Profile</h1>
      <div style={{ marginTop: 20 }}>
        <p><strong>UID:</strong> {uid}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Company:</strong> {user.companyId}</p>
      </div>
    </div>
  );
}
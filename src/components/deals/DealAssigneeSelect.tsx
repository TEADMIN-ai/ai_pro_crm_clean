"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
      const snap = await getDocs(collection(db, "users"));
      const staffUsers = snap.docs
        .map(d => d.data() as User)
        .filter(u => u.role === "staff");

      setUsers(staffUsers);
    }

    loadStaff();
  }, []);

  async function assign(uid: string) {
    setLoading(true);
    await updateDoc(doc(db, "deals", dealId), {
      assignedTo: uid,
    });
    setLoading(false);
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
      {users.map(u => (
        <option key={u.uid} value={u.uid}>
          {u.email}
        </option>
      ))}
    </select>
  );
}

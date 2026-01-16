"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import RequireRole from "@/components/auth/RequireRole";

export default function NewDealPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [title, setTitle] = useState("");

  const createDeal = async () => {
    if (!user || !title) return;

    await addDoc(collection(db, "deals"), {
      title,
      status: "submitted",
      assignedTo: null,
      companyId: "torque-empire",
      createdAt: serverTimestamp(),
    });

    router.push("/dashboard/deals");
  };

  return (
    <RequireRole allow={["admin", "manager"]}>
      <main style={{ padding: 32 }}>
        <h1>New Deal</h1>

        <input
          placeholder="Deal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <button onClick={createDeal}>Create</button>
      </main>
    </RequireRole>
  );
}
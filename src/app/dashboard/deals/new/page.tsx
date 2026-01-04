"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import RequireRole from "@/components/auth/RequireRole";

export default function CreateDealPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [clientName, setClientName] = useState("");
  const [value, setValue] = useState<number | "">("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("Not authenticated");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "deals"), {
        title,
        reference,
        clientName,
        value: value === "" ? 0 : value,
        status,
        ownerId: user.uid,
        ownerEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/dashboard");
    } catch (err: any) {
      console.error("CREATE DEAL FAILED", err);
      setError(err.message || "Failed to create deal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireRole role="user">
      <main style={{ padding: 40, maxWidth: 600 }}>
        <h1>Create Deal</h1>

        <form onSubmit={handleSubmit}>
          <input
            placeholder="Deal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <br /><br />

          <input
            placeholder="Reference / Tender No"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />

          <br /><br />

          <input
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />

          <br /><br />

          <input
            type="number"
            placeholder="Deal value"
            value={value}
            onChange={(e) =>
              setValue(e.target.value === "" ? "" : Number(e.target.value))
            }
          />

          <br /><br />

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          <br /><br />

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create Deal"}
          </button>

          {error && <p style={{ color: "red" }}>{error}</p>}
        </form>
      </main>
    </RequireRole>
  );
}
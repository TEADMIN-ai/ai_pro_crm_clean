"use client";

import { useEffect, useState } from "react";
import { addDealNote, getDealNotes, type DealNote } from "@/lib/firebase/dealNotes";
import { useAuthContext } from "@/context/AuthContext";

export default function DealNotes({ dealId }: { dealId: string }) {
  const { user } = useAuthContext();
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const data = await getDealNotes(dealId);
    setNotes(data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const onAdd = async () => {
    if (!user) return;
    const t = text.trim();
    if (!t) return;

    setLoading(true);
    try {
      await addDealNote({
        dealId,
        text: t,
        createdBy: user.uid,
        companyId: user.companyId,
      });
      setText("");
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Notes</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.15)", color: "#fff" }}
        />
        <button onClick={onAdd} disabled={loading} style={{ padding: "10px 14px", borderRadius: 10 }}>
          {loading ? "Saving…" : "Add"}
        </button>
      </div>

      {notes.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No notes yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.12)" }}>
              <div style={{ opacity: 0.9 }}>{n.text}</div>
              <div style={{ opacity: 0.6, fontSize: 12, marginTop: 6 }}>by {n.createdBy}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

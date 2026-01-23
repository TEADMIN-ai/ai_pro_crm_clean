"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STATUSES = [
  "new",
  "contacted",
  "negotiation",
  "won",
  "lost",
] as const;

type Props = {
  dealId: string;
  currentStatus: string;
  disabled?: boolean;
};

export default function DealStatusUpdater({
  dealId,
  currentStatus,
  disabled,
}: Props) {
  async function handleChange(
    e: React.ChangeEvent<HTMLSelectElement>
  ) {
    const nextStatus = e.target.value;
    await updateDoc(doc(db, "deals", dealId), {
      status: nextStatus,
      updatedAt: new Date(),
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={disabled}
      style={{
        marginTop: 8,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.15)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {STATUSES.map((status) => (
        <option
          key={status}
          value={status}
          style={{ color: "#000" }}
        >
          {status.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

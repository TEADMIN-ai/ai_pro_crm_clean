import { Timestamp } from "firebase/firestore";

export type SLAStatus = "Normal" | "Warning" | "Breached";

export type SLA = {
  key: string;
  label: string;
  status: SLAStatus;
  dueAt: Timestamp;
};

function computeStatus(dueAt: Timestamp, createdAt: Timestamp): SLAStatus {
  const now = Date.now();
  const due = dueAt.toDate().getTime();
  const start = createdAt.toDate().getTime();

  if (now > due) {
    return "Breached";
  }

  const totalWindow = due - start;
  const remaining = due - now;

  if (remaining / totalWindow <= 0.25) {
    return "Warning";
  }

  return "Normal";
}

export function resolveSLAForDeal(
  status: string,
  createdAt?: Timestamp
): SLA | null {
  if (!createdAt) return null;

  const base = createdAt.toDate();

  switch (status) {
    case "submitted": {
      const due = new Date(base);
      due.setHours(due.getHours() + 48);
      const dueAt = Timestamp.fromDate(due);

      return {
        key: "submitted_48h",
        label: "48h Response",
        status: computeStatus(dueAt, createdAt),
        dueAt,
      };
    }

    case "in_review": {
      const due = new Date(base);
      due.setHours(due.getHours() + 24);
      const dueAt = Timestamp.fromDate(due);

      return {
        key: "review_24h",
        label: "24h Review",
        status: computeStatus(dueAt, createdAt),
        dueAt,
      };
    }

    default:
      return null; // lost, awarded, etc.
  }
}


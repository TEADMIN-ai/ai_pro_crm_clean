"use client";

type Status = "READY" | "RISK" | "BLOCKED";

type StatusBadgeProps = {
  status: Status;
};

const classesByStatus: Record<Status, string> = {
  READY: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  RISK: "bg-amber-100 text-amber-700 ring-amber-200",
  BLOCKED: "bg-rose-100 text-rose-700 ring-rose-200",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ${classesByStatus[status]}`}
    >
      {status}
    </span>
  );
}

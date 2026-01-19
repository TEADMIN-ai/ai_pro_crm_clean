"use client";

type Props = {
  slaDueAt?: any;
};

export default function SlaProgress({ slaDueAt }: Props) {
  if (!slaDueAt) return null;

  const due =
    typeof slaDueAt?.toDate === "function"
      ? slaDueAt.toDate()
      : new Date(slaDueAt);

  if (isNaN(due.getTime())) return null;

  const now = new Date();
  const totalMinutes = 24 * 60; // 24h SLA baseline
  const remainingMinutes = Math.floor(
    (due.getTime() - now.getTime()) / 60000
  );

  const percent = Math.max(
    0,
    Math.min(
      100,
      Math.floor((remainingMinutes / totalMinutes) * 100)
    )
  );

  let color = "#22c55e"; // green
  if (remainingMinutes <= 60) color = "#f59e0b"; // orange
  if (remainingMinutes <= 0) color = "#ef4444"; // red

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          height: 6,
          width: "100%",
          background: "rgba(255,255,255,0.08)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          opacity: 0.7,
          marginTop: 4,
        }}
      >
        {remainingMinutes <= 0
          ? "SLA breached"
          : `${remainingMinutes} min remaining`}
      </div>
    </div>
  );
}
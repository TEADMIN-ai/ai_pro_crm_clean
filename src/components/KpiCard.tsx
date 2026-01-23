"use client";

type Props = {
  label: string;
  value: number | string;
};

export default function KpiCard({ label, value }: Props) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 16,
        minHeight: 90,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div className="kpi-label">{label}</div>

      <div
        className="kpi-value"
        style={{
          fontSize: 28,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
"use client";

import Card from "@/components/ui/Card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { empireColors } from "@/theme/empireTheme";

type DocumentStatusGraphProps = {
  role: string | null | undefined;
  visibleModuleCount: number;
};

export default function DocumentStatusGraph({
  role,
  visibleModuleCount,
}: DocumentStatusGraphProps) {
  const adminBoost = role === "admin" ? 2 : 0;
  const data = [
    { status: "Draft", count: 4 + visibleModuleCount },
    { status: "Review", count: 3 + adminBoost },
    { status: "Approved", count: 6 + visibleModuleCount + adminBoost },
    { status: "Expired", count: Math.max(1, 5 - visibleModuleCount) },
  ];

  return (
    <Card>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(109, 182, 255, 0.26)",
          background:
            "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))",
          boxShadow:
            "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)",
          padding: 14,
          fontFamily: "\"Segoe UI\", system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>
          Document Status Distribution
        </p>
        <div style={{ width: "100%", height: 250, marginTop: 10 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="status" stroke={empireColors.textSecondary} />
              <YAxis allowDecimals={false} stroke={empireColors.textSecondary} />
              <Tooltip
                contentStyle={{
                  background: empireColors.surface,
                  border: `1px solid ${empireColors.border}`,
                  color: empireColors.textPrimary,
                }}
              />
              <Bar dataKey="count" fill={empireColors.primary} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

"use client";

import Card from "@/components/ui/Card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { empireColors } from "@/theme/empireTheme";
import type { Deal } from "@/types/deal";

type DealValueGraphProps = {
  deals: Deal[];
};

export default function DealValueGraph({ deals }: DealValueGraphProps) {
  const data = deals.slice(0, 6).map((deal, index) => ({
    month: `D${index + 1}`,
    value: Math.round(deal.value ?? 0),
  }));

  return (
    <Card>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(109, 182, 255, 0.26)",
          background: "linear-gradient(160deg, rgba(11, 26, 46, 0.95), rgba(13, 30, 55, 0.9))",
          boxShadow: "0 16px 38px rgba(74, 145, 255, 0.2), inset 0 0 22px rgba(92, 175, 255, 0.07)",
          padding: 14,
          fontFamily: "\"Segoe UI\", system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Deal Value Momentum</p>
        <div style={{ width: "100%", height: 260, marginTop: 10 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke={empireColors.textSecondary} />
              <YAxis stroke={empireColors.textSecondary} />
              <Tooltip
                contentStyle={{
                  background: empireColors.surface,
                  border: `1px solid ${empireColors.border}`,
                  color: empireColors.textPrimary,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={empireColors.primary}
                strokeWidth={3}
                dot={{ r: 3, stroke: empireColors.primary, fill: empireColors.primary }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

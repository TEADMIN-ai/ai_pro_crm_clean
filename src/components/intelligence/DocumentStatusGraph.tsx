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
import type { Deal } from "@/types/deal";

type DocumentStatusGraphProps = {
  deals: Deal[];
};

export default function DocumentStatusGraph({ deals }: DocumentStatusGraphProps) {
  const data = [
    { status: "Ready", count: deals.filter((deal) => deal.tenderLockStatus === "READY").length },
    { status: "Risk", count: deals.filter((deal) => deal.tenderLockStatus === "RISK").length },
    { status: "Blocked", count: deals.filter((deal) => deal.tenderLockStatus === "BLOCKED").length },
    { status: "Missing Docs", count: deals.filter((deal) => deal.docsMissing).length },
  ];

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
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, color: "#b7ceef" }}>Document Status Distribution</p>
        <div className="relative mx-auto mt-[10px] flex h-[250px] w-full max-w-[420px] items-center justify-center overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
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

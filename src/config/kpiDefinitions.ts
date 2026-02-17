import type { Deal } from "@/types/deal";

export const KPI_DEFINITIONS = [
  {
    label: "Total Deals",
    value: (deals: Deal[]) => deals.length,
  },
  {
    label: "Unassigned Deals",
    value: (deals: Deal[]) =>
      deals.filter(
        (d) => !d.assignedTo || String(d.assignedTo).trim() === ""
      ).length,
  },
  {
    label: "Won Deals",
    value: (deals: Deal[]) => deals.filter((d) => d.stage === "won").length,
  },
  {
    label: "Lost Deals",
    value: (deals: Deal[]) => deals.filter((d) => d.stage === "lost").length,
  },
];


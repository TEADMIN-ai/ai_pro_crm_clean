import { Deal, DealStage } from "@/types/deal";

/* =========================
   KPI IDENTIFIERS
========================= */

export type KPIKey =
  | "totalDeals"
  | "newLeads"
  | "inNegotiation"
  | "won"
  | "lost"
  | "unassigned"
  | "myDeals"
  | "openDeals";

/* =========================
   KPI DEFINITION STRUCTURE
========================= */

export interface KPIDefinition {
  key: KPIKey;
  label: string;
  description: string;
  roles: ("admin" | "manager" | "staff")[];
  compute: (deals: Deal[], userId?: string) => number;
}

/* =========================
   FINAL KPI DEFINITIONS
========================= */

export const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    key: "totalDeals",
    label: "Total Deals",
    description: "All deals in the system",
    roles: ["admin", "manager"],
    compute: (deals) => deals.length,
  },
  {
    key: "newLeads",
    label: "New Leads",
    description: "Leads and tenders in early pipeline",
    roles: ["admin", "manager"],
    compute: (deals) =>
      deals.filter(
        (d) => d.stage === "lead" || d.stage === "tender"
      ).length,
  },
  {
    key: "inNegotiation",
    label: "Negotiation",
    description: "Deals currently in negotiation",
    roles: ["admin", "manager"],
    compute: (deals) =>
      deals.filter((d) => d.stage === "negotiation").length,
  },
  {
    key: "won",
    label: "Won",
    description: "Successfully closed deals",
    roles: ["admin", "manager", "staff"],
    compute: (deals, userId) =>
      deals.filter(
        (d) =>
          d.stage === "won" &&
          (!userId || d.ownerId === userId)
      ).length,
  },
  {
    key: "lost",
    label: "Lost",
    description: "Deals that were lost",
    roles: ["admin", "manager"],
    compute: (deals) =>
      deals.filter((d) => d.stage === "lost").length,
  },
  {
    key: "unassigned",
    label: "Unassigned",
    description: "Deals without an owner",
    roles: ["admin", "manager"],
    compute: (deals) =>
      deals.filter((d) => !d.ownerId).length,
  },
  {
    key: "myDeals",
    label: "My Deals",
    description: "Deals assigned to the current user",
    roles: ["staff"],
    compute: (deals, userId) =>
      deals.filter((d) => d.ownerId === userId).length,
  },
  {
    key: "openDeals",
    label: "Open",
    description: "Open deals assigned to the user",
    roles: ["staff"],
    compute: (deals, userId) =>
      deals.filter(
        (d) =>
          d.ownerId === userId &&
          d.stage !== "won" &&
          d.stage !== "lost" &&
          d.stage !== "closed"
      ).length,
  },
];
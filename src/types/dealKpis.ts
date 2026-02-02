// src/types/dealKpis.ts

export type DealKpiKey =
  | "totalPipeline"
  | "weightedPipeline"
  | "wonDeals"
  | "avgDealSize";

export type DealKpiDefinition = {
  key: DealKpiKey;
  label: string;
};
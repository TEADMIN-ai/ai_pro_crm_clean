import type { WinProbabilityResult } from "@/lib/intelligence/winProbabilityIndex";

export type WpiHistoryPoint = {
  probability: number;
  riskScore: number;
  timestamp?: number;
};

export type TenderTrajectoryResult = {
  direction: "up" | "down" | "flat";
  delta: number;
  momentumLabel: "Improving" | "Declining" | "Stable";
};

export function tenderTrajectory(
  current: WinProbabilityResult,
  previous?: WpiHistoryPoint | null
): TenderTrajectoryResult {
  if (!previous || !Number.isFinite(previous.probability)) {
    return {
      direction: "flat",
      delta: 0,
      momentumLabel: "Stable",
    };
  }

  const rawDelta = current.probability - previous.probability;
  const delta = Math.round(rawDelta * 10) / 10;

  if (delta > 0) {
    return {
      direction: "up",
      delta,
      momentumLabel: "Improving",
    };
  }

  if (delta < 0) {
    return {
      direction: "down",
      delta,
      momentumLabel: "Declining",
    };
  }

  return {
    direction: "flat",
    delta: 0,
    momentumLabel: "Stable",
  };
}

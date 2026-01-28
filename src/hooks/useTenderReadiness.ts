// src/hooks/useTenderReadiness.ts

"use client";

import { useMemo } from "react";
import type { Deal } from "@/types/deal";

/**
 * Tender document requirement
 */
export type TenderRequirement = {
  id: string;
  label: string;
  required: boolean;
};

/**
 * Uploaded tender document
 */
export type TenderDocument = {
  id: string;
  name: string;
};

/**
 * Match result per requirement
 */
export type RequirementMatch = {
  requirement: TenderRequirement;
  matchedDoc: TenderDocument | null;
  matchType: "id" | "name" | "none";
};

/**
 * Readiness output (UI-safe)
 */
export type TenderReadiness = {
  totalRequired: number;
  matchedCount: number;
  coveragePercent: number;
  status: "ready" | "partial" | "not-ready";
  matches: RequirementMatch[];
};

/**
 * Core Tender Readiness Hook
 */
export function useTenderReadiness(
  deal: Deal | null,
  requirements: TenderRequirement[],
  uploadedDocs: TenderDocument[]
): TenderReadiness {
  return useMemo(() => {
    if (!deal) {
      return {
        totalRequired: 0,
        matchedCount: 0,
        coveragePercent: 0,
        status: "not-ready",
        matches: [],
      };
    }

    const matches: RequirementMatch[] = requirements.map((req) => {
      // Match by ID first
      const byId =
        uploadedDocs.find((d) => d.id === req.id) ?? null;

      if (byId) {
        return {
          requirement: req,
          matchedDoc: byId,
          matchType: "id",
        };
      }

      // Match by name (case-insensitive)
      const byName =
        uploadedDocs.find((d) =>
          d.name.toLowerCase().includes(req.label.toLowerCase())
        ) ?? null;

      if (byName) {
        return {
          requirement: req,
          matchedDoc: byName,
          matchType: "name",
        };
      }

      return {
        requirement: req,
        matchedDoc: null,
        matchType: "none",
      };
    });

    const requiredCount = requirements.filter(r => r.required).length;
    const matchedCount = matches.filter(
      m => m.requirement.required && m.matchedDoc
    ).length;

    const coveragePercent =
      requiredCount > 0
        ? Math.round((matchedCount / requiredCount) * 100)
        : 0;

    let status: TenderReadiness["status"] = "not-ready";

    if (coveragePercent === 100) status = "ready";
    else if (coveragePercent >= 60) status = "partial";

    return {
      totalRequired: requiredCount,
      matchedCount,
      coveragePercent,
      status,
      matches,
    };
  }, [deal, requirements, uploadedDocs]);
}
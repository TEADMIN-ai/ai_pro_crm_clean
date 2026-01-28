// src/lib/tender/tenderMapping.ts
// Phase E2 — Tender requirement ↔ document mapping
// No Firebase, no AI, no UI (pure engine)

import {
  TenderRequirement,
  TenderDocument,
} from "./tenderIntelligence";

export type RequirementMatch = {
  requirement: TenderRequirement;
  matchedDoc: TenderDocument | null;
  matchType: "id" | "name" | "none";
};

export type TenderDocumentCoverage = {
  tenderId: string;
  matches: RequirementMatch[];
  missingCount: number;
  coverageRatio: number;
};

export function mapTenderRequirements(
  tenderId: string,
  requirements: TenderRequirement[],
  uploadedDocs: TenderDocument[]
): TenderDocumentCoverage {
  const matches: RequirementMatch[] = requirements.map(
    (req: TenderRequirement) => {
      const byId = uploadedDocs.find(
        (doc: TenderDocument) => doc.id === req.id
      );

      if (byId) {
        return {
          requirement: req,
          matchedDoc: byId,
          matchType: "id",
        };
      }

      const byName = uploadedDocs.find(
        (doc: TenderDocument) =>
          doc.name.toLowerCase() === req.label.toLowerCase()
      );

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
    }
  );

  const missingCount = matches.filter(
    (m: RequirementMatch) =>
      m.requirement.mandatory && m.matchedDoc === null
  ).length;

  return {
    tenderId,
    matches,
    missingCount,
    coverageRatio:
      requirements.length === 0
        ? 1
        : (requirements.length - missingCount) / requirements.length,
  };
}
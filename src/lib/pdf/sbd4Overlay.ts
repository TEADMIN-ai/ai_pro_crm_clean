import { generateSBD4OverlayDocument } from "@/lib/pdf/sbd4-overlay/service";
import {
  mapLegacyTenderToTenderData,
  type LegacyTenderSource,
} from "@/lib/tender/mappers/tender.mapper";
import type { TenderData } from "@/types/tender.types";

type Director = {
  name: string;
  id: string;
  entity: string;
};

export type SBD4OverlayInput = {
  directors: Director[];
  hasRelationship?: "YES" | "NO";
  declarationName?: string;
};

type SBD4OverlayBoundaryInput = TenderData | LegacyTenderSource | SBD4OverlayInput;

function isCanonicalTenderData(data: SBD4OverlayBoundaryInput): data is TenderData {
  return (
    typeof data === "object" &&
    data !== null &&
    "schemaFamily" in data &&
    data.schemaFamily === "TenderData" &&
    "schemaVersion" in data
  );
}

function isSBD4OverlayInput(data: SBD4OverlayBoundaryInput): data is SBD4OverlayInput {
  return !isCanonicalTenderData(data) && Array.isArray(data.directors);
}

function mapSBD4OverlayInputToLegacyTenderSource(data: SBD4OverlayInput): LegacyTenderSource {
  return {
    tenderTitle: data.declarationName ?? "SBD4 Overlay",
    declarationName: data.declarationName,
    hasRelationship: data.hasRelationship,
    directors: data.directors,
  };
}

function resolveTenderData(data: SBD4OverlayBoundaryInput): TenderData {
  if (isCanonicalTenderData(data)) {
    return data;
  }

  if (isSBD4OverlayInput(data)) {
    return mapLegacyTenderToTenderData(mapSBD4OverlayInputToLegacyTenderSource(data));
  }

  return mapLegacyTenderToTenderData(data);
}

export async function generateSBD4Overlay(data: SBD4OverlayBoundaryInput) {
  return generateSBD4OverlayDocument(resolveTenderData(data));
}

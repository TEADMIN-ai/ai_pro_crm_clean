import {
  mapLegacyTenderToTenderData,
  type LegacyTenderSource,
} from "@/lib/tender/mappers/tender.mapper";
import { generateSBD1OverlayDocument } from "@/lib/pdf/sbd1-overlay/service";
import type { SBD1OverlayInput } from "@/types/sbd";
import type { TenderData } from "@/types/tender.types";

export type { SBD1OverlayInput } from "@/types/sbd";

type SBD1OverlayBoundaryInput = TenderData | LegacyTenderSource | SBD1OverlayInput;

function isCanonicalTenderData(data: SBD1OverlayBoundaryInput): data is TenderData {
  return (
    typeof data === "object" &&
    data !== null &&
    "schemaFamily" in data &&
    data.schemaFamily === "TenderData" &&
    "schemaVersion" in data
  );
}

function isSBD1OverlayInput(data: SBD1OverlayBoundaryInput): data is SBD1OverlayInput {
  return (
    !isCanonicalTenderData(data) &&
    ("generatedAt" in data || "companyAddressLine1" in data || "companyAddressLine2" in data)
  );
}

function mapSBD1OverlayInputToLegacyTenderSource(data: SBD1OverlayInput): LegacyTenderSource {
  return {
    tenderTitle: data.companyName ?? "SBD1 Overlay",
    companyName: data.companyName ?? undefined,
    companyAddressLine1: data.companyAddressLine1 ?? undefined,
    companyAddressLine2: data.companyAddressLine2 ?? undefined,
    contactNumber: data.contactNumber ?? undefined,
    email: data.email ?? undefined,
    vatNumber: data.vatNumber ?? undefined,
    bbbee: data.bbbee ?? undefined,
    updatedAt: data.generatedAt,
  };
}

function resolveTenderData(data: SBD1OverlayBoundaryInput): TenderData {
  if (isCanonicalTenderData(data)) {
    return data;
  }

  if (isSBD1OverlayInput(data)) {
    return mapLegacyTenderToTenderData(mapSBD1OverlayInputToLegacyTenderSource(data));
  }

  return mapLegacyTenderToTenderData(data);
}

export async function generateSBD1Overlay(data: SBD1OverlayBoundaryInput) {
  return generateSBD1OverlayDocument(resolveTenderData(data));
}

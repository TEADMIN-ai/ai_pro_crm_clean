import { buildSBD1OverlayPlan } from "./mapper";
import { renderSBD1Overlay } from "./renderer";
import { loadSbd1OverlayTemplate } from "./templateLoader";
import { validateSBD1OverlayInput } from "./validator";
import { mapTenderDataToSBD1OverlayInput } from "@/lib/tender/mappers/tender.mapper";
import type { TenderData } from "@/types/tender.types";

export async function generateSBD1OverlayDocument(tenderData: TenderData): Promise<Uint8Array | null> {
  const sbd1Input = mapTenderDataToSBD1OverlayInput(tenderData);
  const validation = validateSBD1OverlayInput(sbd1Input);

  if (!validation.isValid) {
    console.warn("SBD1 overlay validation failed", {
      issues: validation.issues,
      tenderId: tenderData.tenderId,
    });
    return null;
  }

  const templateBytes = await loadSbd1OverlayTemplate();

  if (!templateBytes) {
    console.warn("SBD1 overlay template could not be loaded", {
      tenderId: tenderData.tenderId,
    });
    return null;
  }

  console.info("SBD1 overlay generation started", {
    tenderId: tenderData.tenderId,
    hasCompanyName: Boolean(validation.value.companyName),
    hasEmail: Boolean(validation.value.email),
  });

  return renderSBD1Overlay(buildSBD1OverlayPlan(validation.value), templateBytes);
}

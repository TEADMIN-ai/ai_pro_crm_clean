import { searchMaterials } from "@/lib/qs/search";
import type { QsBoqConfidence, QsBoqMaterialMatch } from "@/types/qs";

function confidenceFromCandidateCount(count: number): QsBoqConfidence {
  if (count === 1) return "High";
  if (count > 1) return "Medium";
  return "Low";
}

export async function matchBoqMaterial(description: string, unit?: string | null): Promise<QsBoqMaterialMatch> {
  const candidates = [
    description.split(/\s+/).slice(0, 6).join(" "),
    ...description.split(/\s+/).filter((token) => token.length >= 4).slice(0, 4),
  ];
  let matches = [];

  for (const materialName of candidates) {
    matches = await searchMaterials({ materialName, limit: 5 });
    if (matches.length > 0) {
      break;
    }
  }
  const confidence = confidenceFromCandidateCount(matches.length);
  const selected = matches[0] ?? null;

  return {
    materialId: selected?.materialId ?? null,
    materialName: selected?.name ?? null,
    matchConfidence: unit && selected?.unit === unit && confidence !== "Low" ? "High" : confidence,
    suggestedMaterialIds: matches.slice(1).map((material) => material.materialId),
    unknownMaterial: matches.length === 0,
  };
}

import { generateSBD4 } from "@/lib/pdf/generateSBD4";

type DealInput = Record<string, unknown>;
type ContractorInput = Record<string, unknown>;

export async function generateSBD4Template(deal: DealInput, contractor: ContractorInput) {
  return generateSBD4(deal, contractor);
}

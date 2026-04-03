import { generateSBD1 } from "@/lib/pdf/empirePdfEngine";

type DealInput = Record<string, unknown>;
type ContractorInput = Record<string, unknown>;

export async function generateSBD1Template(deal: DealInput, contractor: ContractorInput) {
  return generateSBD1(deal, contractor);
}

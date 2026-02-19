import { getContractors } from "@/lib/contractors/getContractors";
import type { Contractor } from "@/types/contractor";

export async function getContractor(contractorId: string): Promise<Contractor> {
  if (!contractorId || contractorId.trim().length === 0) {
    throw new Error("Invalid contractor ID");
  }

  try {
    const contractors = await getContractors();
    const contractor = contractors.find((item) => item.id === contractorId);
    if (!contractor) {
      throw new Error("Contractor not found");
    }
    return contractor;
  } catch (error) {
    console.error("Failed to fetch contractor:", error);
    if (error instanceof Error && error.message === "Contractor not found") {
      throw error;
    }
    throw new Error("Failed to fetch contractor");
  }
}

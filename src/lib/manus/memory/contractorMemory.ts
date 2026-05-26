import { getManusFeatureFlags } from "@/lib/manus/config/featureFlags";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { ContractorMemory } from "@/lib/manus/types/manus.types";

const defaultMemory = (contractorId: string): ContractorMemory => ({
  contractorId,
  lastUpdatedAt: new Date().toISOString(),
  submissionHistory: [],
  complianceHistory: [],
  readinessTrends: [],
  documentExpiryPatterns: [],
  repeatedComplianceFailures: [],
  industryPreferences: [],
  riskPatterns: [],
  submissionSuccessTrends: [],
});

export class ContractorMemoryStore {
  async get(contractorId: string): Promise<ContractorMemory> {
    if (!getManusFeatureFlags().ENABLE_MANUS_MEMORY) {
      return defaultMemory(contractorId);
    }

    const snapshot = await getFirebaseAdmin()
      .collection("contractors")
      .doc(contractorId)
      .collection("manus")
      .doc("memory")
      .get();

    if (!snapshot.exists) {
      return defaultMemory(contractorId);
    }

    return {
      ...defaultMemory(contractorId),
      ...(snapshot.data() as Partial<ContractorMemory>),
      contractorId,
    };
  }

  async update(contractorId: string, patch: Partial<ContractorMemory>) {
    if (!getManusFeatureFlags().ENABLE_MANUS_MEMORY) {
      return;
    }

    await getFirebaseAdmin()
      .collection("contractors")
      .doc(contractorId)
      .collection("manus")
      .doc("memory")
      .set(
        {
          ...patch,
          contractorId,
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
  }
}
